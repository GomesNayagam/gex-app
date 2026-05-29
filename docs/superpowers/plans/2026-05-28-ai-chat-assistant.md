# Plan: AI Chat Assistant ("Ask FlashAlpha")

## Context

The GEX dashboard has rich data features but no conversational entry point. We want a floating AI
chat widget — reachable from **any** route — where a trader asks plain-English questions like
*"what is the spx gex call wall"* and gets an answer grounded in **live** options data.

The user originally pointed at the FlashAlpha **MCP** server. Key finding: that MCP server is a
*tool server, not a chat API* — it can't interpret natural language. Answering a question requires
an **LLM running a tool-use loop**. After discussion we decided **not** to wire the hosted MCP
endpoint (its `apiKey`-tool-param auth doesn't fit Anthropic's header-based connector, adding
complexity). Instead we reuse the **existing REST `FlashAlphaAdapter`** — which already handles the
`X-Api-Key` header correctly — and expose a few of its methods to Claude as hand-written tools. Same
data, same FlashAlpha account, far less moving infrastructure.

**Decisions (from discussion):** Claude via Anthropic API · **reuse existing REST adapter** (not MCP)
· paid FlashAlpha plan · scope = streaming + persisted history + abuse guardrails + suggested prompts.

## Architecture

```
Browser ChatWidget ──POST /api/chat/stream (SSE)──▶ FastAPI chat router
                                                        │
                                                        ▼
                                              services/chat.py
                                          (Claude tool-use loop, streaming)
                                             │                      │
                              Anthropic Messages API        existing get_adapter()
                              (claude-sonnet-4-6)         → FlashAlphaAdapter (REST)
                                                            X-Api-Key, already built
```

**Tool-use loop:** stream a Claude turn → if it ends in `tool_use`, invoke the matching adapter
method, append a `tool_result`, stream the next turn → repeat until a final text turn (capped by
`chat_max_tool_iterations`). Text deltas and "tool used" markers stream to the browser over SSE.

**Tools exposed to Claude** (thin wrappers over existing adapter methods — *no new FlashAlpha
calls invented*):
- `get_gex(symbol, expiration?)` → adapter's GEX fetch (returns strikes, net GEX, gamma flip, call
  wall / put wall — directly answers the motivating question).
- `get_levels(symbol)` → key support/resistance / dealer levels (if exposed by the adapter; else
  derive from the GEX key-levels already in the response).
- `list_symbols()` → `available_symbols()` so Claude can validate tickers.

Each tool's JSON schema is hand-written to match the adapter signature. Start with these three;
adding more later is a one-function change.

## Backend changes

**`pyproject.toml`** — `uv add anthropic`.

**`backend/config.py`** — add settings (env-derived):
- `anthropic_api_key: Optional[str] = None`
- `anthropic_model: str = "claude-sonnet-4-6"` — **verify it's a current API model string at
  execution time**; a stale ID fails the first request with an opaque 404.
- `chat_max_messages_per_session: int = 30` · `chat_max_tokens: int = 2048` ·
  `chat_max_tool_iterations: int = 6`

**`backend/.env.example`** — document `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`). `.env`
stays gitignored. The existing `FLASH_ALPHA_API_KEY` is reused as-is.

**`backend/services/chat.py`** (new) — the core. Async, mirrors existing service style:
- `TOOLS` — the Anthropic `tools` schema list (the three above).
- `async def _run_tool(name, args)` — dispatch to `get_adapter()` methods; serialize the pydantic
  result (e.g. `.model_dump()`) into the `tool_result`. Catch adapter errors (incl. 429/quota) and
  return them as a `tool_result` string so Claude explains the limit instead of the stream dying.
- `async def stream_chat(messages) -> AsyncIterator[event]` — streamed tool-use loop via
  `anthropic.AsyncAnthropic(...).messages.stream(...)`, capped by `chat_max_tool_iterations` /
  `chat_max_tokens`. Yields `{type:"text",delta}`, `{type:"tool",name}`, `{type:"error",message}`,
  `{type:"done"}`. **Streaming + tool-use is the subtle part:** the model emits text within
  tool-use turns too — per turn, accumulate the full assistant message (text + `tool_use` blocks); if
  it ended in `tool_use`, run the tools and loop; the final non-tool turn's text is the answer.
- System prompt: terse persona ("You are FlashAlpha's options-analytics assistant. Use the tools for
  any live data; never invent numbers."), include today's date.
- Reuse `services/cache.py` (already TTL-caches adapter results) so repeated identical questions
  don't re-hit FlashAlpha.

**`backend/routers/chat.py`** (new) — `APIRouter(prefix="/api", tags=["Chat"])`:
- `POST /api/chat/stream` → `StreamingResponse(media_type="text/event-stream")` driving
  `chat.stream_chat`. Body: `{session_id, messages:[{role, content}]}`.
- Guardrails: in-memory `dict[session_id -> count]`, reject past `chat_max_messages_per_session`
  with a clean SSE error event. Best-effort only (resets on restart, bypassable) — add a size cap so
  the dict can't grow unbounded. Return `503` (clear message) if `anthropic_api_key` unset.

**`backend/main.py`** — `from backend.routers import chat` + `app.include_router(chat.router)`.
CORS already permissive.

## Frontend changes

All under existing conventions (CSS vars, IBM Plex Mono, `cn()`, `lucide-react`, `@/` alias).
Mounted in **`components/shell/AppShell.jsx`** so it renders once and is available on every route.

**`frontend/src/api.js`** — add `streamChat({sessionId, messages}, onEvent)` using `fetch` +
`response.body.getReader()` to parse the SSE stream (EventSource can't POST a body).

**`frontend/src/hooks/useAIChat.js`** (new) — mirrors `useSidebar`/`useFlowSignals`: holds
`messages`, `open`, `loading`; `sendMessage()` appends the user msg, opens an empty assistant msg,
accumulates streamed `text`/`tool` events into it. Persists `messages` + a generated `session_id` to
`localStorage` (`ai-chat-messages`, `ai-chat-session`). `clear()` resets.

**`frontend/src/components/ai/ChatWidget.jsx`** (new) — floating round button (`fixed bottom-right
z-50`, `--blue` accent, Sparkles icon) → opens a ~380px panel reusing the `SignalDetailDrawer`
overlay pattern (fixed panel + `bg-black/30` backdrop, close on backdrop/✕). Empty state shows
**suggested prompts** ("SPX gamma flip?", "QQQ put wall?", "SPY 0DTE pin risk?"). Scrollable message
list + sticky input.

**`frontend/src/components/ai/ChatMessage.jsx`** (new) — user bubble (right, `--surface-2`) vs
assistant (left); small "⛁ via `get_gex`" tool chip when a tool was used; spinner while streaming.

**`frontend/src/components/ai/ChatInput.jsx`** (new) — textarea + send button (Enter to send,
Shift+Enter newline); disabled while `loading`.

## Markup (target UI)

```
COLLAPSED (every route, bottom-right)         EXPANDED (chat drawer ~380px)
                                        ┌─────────────────────────────────┐
                                        │ ✦ Ask FlashAlpha          — ✕   │
                                        ├─────────────────────────────────┤
                                        │            what is the spx gex   │  user (right)
                                        │            call wall             │
                                        │  ✦ The SPX call wall sits at     │  assistant (left)
                                        │    5,800 — largest +gamma strike;│
                                        │    γ-flip at 5,710.              │
                                        │    ⛁ via get_gex(SPX)           │  tool chip
                          ┌─────┐       ├─────────────────────────────────┤
                          │  ✦  │       │ Ask about GEX, levels, vol…  [→] │
                          └─────┘       └─────────────────────────────────┘
```

## Verification (end-to-end)

1. **Setup:** add `ANTHROPIC_API_KEY` + valid `FLASH_ALPHA_API_KEY` to `backend/.env`; `uv sync`.
2. **Backend smoke:** `uv run uvicorn backend.main:app --reload --port 8000`, then
   `curl -N -X POST localhost:8000/api/chat/stream -H 'content-type: application/json' -d
   '{"session_id":"t1","messages":[{"role":"user","content":"what is the spx gex call wall"}]}'`
   → expect SSE `text` deltas naming the call-wall strike + a `tool` event for `get_gex`.
3. **Frontend:** `cd frontend && npm run dev` → click the ✦ bubble, ask the question, confirm the
   answer streams in with a tool chip; refresh → history persists; navigate routes → widget stays.
4. **UI validation:** browser MCP per CLAUDE.md (open widget, send prompt, screenshot).
5. **Guardrails:** exceed per-session cap → clean "limit reached"; unset `ANTHROPIC_API_KEY` → clear
   503; force a FlashAlpha quota error → Claude explains the rate limit rather than the stream dying.

## Out of scope (v1)

Hosted MCP endpoint wiring, per-user auth/keys, server-side conversation storage, multi-symbol
dashboards from chat, voice. More tools (DEX/VEX, volatility, 0DTE, max pain) are easy follow-ons —
each is one wrapper function once the loop works.
