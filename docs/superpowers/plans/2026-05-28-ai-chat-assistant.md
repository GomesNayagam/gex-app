# Plan: AI Chat Assistant ("Ask FlashAlpha")

## Context

The GEX dashboard has rich data features but no conversational entry point. We want a floating AI
chat widget — reachable from **any** route — where a trader asks plain-English questions like
*"what is the spx gex call wall"* and gets an answer grounded in **live** options data.

The user originally pointed at the FlashAlpha **MCP** server. Key finding: that MCP server is a
*tool server, not a chat API* — it can't interpret natural language. Answering a question requires
an **LLM running a tool-use loop**. After discussion we decided **not** to wire the hosted MCP
endpoint (its `apiKey`-tool-param auth doesn't fit a header-based connector, adding complexity).
Instead we reuse the **existing REST `FlashAlphaAdapter`** — which already handles the `X-Api-Key`
header correctly — and expose a few of its methods to the model as hand-written tools. Same data,
same FlashAlpha account, far less moving infrastructure.

**LLM layer decision (revised):** use **OpenRouter** (`https://openrouter.ai/api/v1`) as the model
gateway rather than a single hard-wired vendor API. OpenRouter is an **OpenAI-compatible** endpoint
that routes to many providers behind one key — this makes the assistant **model-agnostic** (swap
models by changing one env value) and **cost-effective** (default to a cheap model, escalate only if
needed). OpenRouter ships **no agent SDK of its own**; we drive the tool-use loop with **Pydantic AI**,
which fits this pydantic/FastAPI codebase, gives type-safe tools, and runs the tool loop + streaming
for us. Observability is provided by **Pydantic Logfire** (same authors as Pydantic AI) — one-line
instrumentation traces every agent run, tool call, model request, latency, and token cost.

**Decisions (from discussion):**
- Model gateway = **OpenRouter** (OpenAI-compatible), **model-agnostic + cost-effective**.
- Agent framework = **Pydantic AI** (it owns the tool-use loop; no hand-written iterate-until-final loop).
- Default model = **`google/gemini-2.5-flash`** (cheap, capable), overridable via `OPENROUTER_MODEL`
  with **zero code change**. *Verify this slug is a current OpenRouter model id at execution time.*
- **Per-user model override in Settings:** a text input in the Settings page lets the trader type any
  OpenRouter model slug; it persists to localStorage and rides along in the chat request body. The
  backend uses the request-supplied model when valid, else falls back to the `OPENROUTER_MODEL` env
  default. Empty box = server default. (No per-message picker in the widget itself.)
- Observability = **Pydantic Logfire**, gated on `LOGFIRE_TOKEN` (no-op / local when unset).
- Data source = **reuse existing REST `FlashAlphaAdapter`** (not MCP) · paid FlashAlpha plan.
- Scope = streaming + persisted history + abuse guardrails + suggested prompts.

## Architecture

```
Browser ChatWidget ──POST /api/chat/stream (SSE)──▶ FastAPI chat router
                                                        │
                                                        ▼
                                              services/chat.py
                                         Pydantic AI Agent (streaming)
                                             │                      │
                          OpenAIModel → OpenRouter         existing get_adapter()
                          base_url=openrouter/api/v1     → FlashAlphaAdapter (REST)
                          model=google/gemini-2.5-flash    X-Api-Key, already built
                                             │
                                   Logfire instrumentation
                              (agent runs, tool calls, model spans,
                               httpx FlashAlpha calls, token cost)
```

**Tool-use loop:** Pydantic AI runs the loop internally — when the model emits a tool call, the
framework invokes the matching `@agent.tool`, feeds the result back, and continues until a final
text answer (capped by model `max_tokens` / our `chat_max_tool_iterations` guard). We stream with
Pydantic AI's streaming API (`agent.run_stream()` / `agent.iter()`), mapping framework events onto
the **same SSE event shapes** the frontend already expects, so the browser contract is unchanged.

**Tools exposed to the model** (thin wrappers over existing adapter methods — *no new FlashAlpha
calls invented*):
- `get_gex(symbol, expiration?)` → adapter's GEX fetch (returns strikes, net GEX, gamma flip, call
  wall / put wall — directly answers the motivating question).
- `get_levels(symbol)` → key support/resistance / dealer levels (if exposed by the adapter; else
  derive from the GEX key-levels already in the response).
- `list_symbols()` → `available_symbols()` so the model can validate tickers.

Each tool is a typed Python function registered with `@agent.tool` / `@agent.tool_plain`; Pydantic AI
generates the JSON schema from the signature. Start with these three; adding more later is a
one-function change.

## Backend changes

**`pyproject.toml`** — `uv add pydantic-ai logfire`. (Use the Logfire pydantic-ai integration extra
if the installed versions require it — *verify the exact package/extra names at execution time*.)
Remove any `anthropic` dependency if it was added.

**`backend/config.py`** — add settings (env-derived):
- `openrouter_api_key: Optional[str] = None`
- `openrouter_base_url: str = "https://openrouter.ai/api/v1"`
- `openrouter_model: str = "google/gemini-2.5-flash"` — cheap default; **verify it's a current
  OpenRouter model slug at execution time**; a stale id fails the first request.
- `logfire_token: Optional[str] = None` · `logfire_service_name: str = "gex-chat"`
- `chat_max_messages_per_session: int = 30` · `chat_max_tokens: int = 2048` ·
  `chat_max_tool_iterations: int = 6`

**`backend/.env.example`** — document `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`,
`LOGFIRE_TOKEN`). `.env` stays gitignored. The existing `FLASH_ALPHA_API_KEY` is reused as-is.

**Logfire setup** (app startup in `backend/main.py`, or a small `services/observability.py`):
- `logfire.configure(token=settings.logfire_token, service_name=settings.logfire_service_name)`
  guarded so it is a **no-op / local-only when `LOGFIRE_TOKEN` is unset** (follow the app's existing
  optional-API-key pattern — never block chat on missing observability).
- `logfire.instrument_pydantic_ai()` — traces every agent run, tool call, model request, latency,
  token usage / cost.
- `logfire.instrument_fastapi(app)` + `logfire.instrument_httpx()` — so the FlashAlpha REST calls
  appear inside the same trace as the agent run.

**`backend/services/chat.py`** (new) — the core. Async, mirrors existing service style:
- Build a module-level (or lazily-constructed) Pydantic AI `Agent` over an `OpenAIModel` pointed at
  OpenRouter. **Verify the exact wiring at execution time** — recent Pydantic AI ships a dedicated
  `OpenRouterProvider`; the stable fallback is `OpenAIModel(settings.openrouter_model,
  provider=OpenAIProvider(base_url=settings.openrouter_base_url, api_key=settings.openrouter_api_key))`.
- Register the three tools with `@agent.tool` / `@agent.tool_plain`, dispatching to `get_adapter()`
  methods. Catch adapter errors (incl. 429/quota) inside the tool and **return them as a tool
  result string** so the model explains the limit instead of the stream dying.
- `async def stream_chat(messages, model=None) -> AsyncIterator[event]` — run the agent with
  Pydantic AI's streaming API. When `model` is supplied (from the Settings override), use it for this
  run (Pydantic AI lets you pass a model per `run`/`run_stream`, or construct an `OpenAIModel` on the
  fly with the same OpenRouter provider); otherwise use the env default. Map framework events →
  `{type:"text",delta}`, `{type:"tool",name}`,
  `{type:"error",message}`, `{type:"done"}`. Pydantic AI owns the tool loop, so we no longer
  hand-write the accumulate-message / iterate-until-final logic — we just translate its event
  stream to SSE. Enforce `chat_max_tokens` / `chat_max_tool_iterations` via agent run settings.
- System prompt: terse persona ("You are FlashAlpha's options-analytics assistant. Use the tools for
  any live data; never invent numbers."), include today's date.
- Reuse `services/cache.py` (already TTL-caches adapter results) so repeated identical questions
  don't re-hit FlashAlpha.

**`backend/routers/chat.py`** (new) — `APIRouter(prefix="/api", tags=["Chat"])`:
- `POST /api/chat/stream` → `StreamingResponse(media_type="text/event-stream")` driving
  `chat.stream_chat`. Body: `{session_id, messages:[{role, content}], model?}`. The optional `model`
  is **validated** (non-empty, length-capped ≤ ~100 chars, matches `^[\w./:-]+$`); reject malformed
  values by falling back to the env default rather than passing arbitrary client input to OpenRouter.
- Guardrails: in-memory `dict[session_id -> count]`, reject past `chat_max_messages_per_session`
  with a clean SSE error event. Best-effort only (resets on restart, bypassable) — add a size cap so
  the dict can't grow unbounded. Return `503` (clear message) if `openrouter_api_key` unset.

**`backend/main.py`** — `from backend.routers import chat` + `app.include_router(chat.router)`;
configure Logfire here (see above). CORS already permissive.

## Frontend changes

The SSE event contract (`text` / `tool` / `error` / `done`) is identical regardless of the backend
LLM layer, so the chat widget is unchanged from the original design. The **only** new frontend work is
the Settings model override (below). All under existing conventions (CSS vars, IBM Plex Mono, `cn()`,
`lucide-react`, `@/` alias). The widget is mounted in **`components/shell/AppShell.jsx`** so it
renders once and is available on every route.

**`frontend/src/lib/chatSettings.js`** (new) — mirrors `lib/refreshSettings.js`: `getChatModel()` /
`setChatModel(str)` over localStorage key `ai-chat-model`. Returns `""` (meaning "server default")
when unset. Trim on write.

**`frontend/src/views/Settings.jsx`** — add an **"AI Assistant"** `<section>` (same markup idiom as
the Theme / Refresh Intervals sections) with a text `<input>` bound to `getChatModel()` /
`setChatModel()`. Placeholder = the server default slug (`google/gemini-2.5-flash`); helper text:
"OpenRouter model slug, e.g. `anthropic/claude-sonnet-4`. Leave blank to use the server default. See
openrouter.ai/models." Empty input clears the override.

**`frontend/src/api.js`** — add `streamChat({sessionId, messages, model}, onEvent)` using `fetch` +
`response.body.getReader()` to parse the SSE stream (EventSource can't POST a body). Include `model`
in the POST body only when non-empty.

**`frontend/src/hooks/useAIChat.js`** (new) — mirrors `useSidebar`/`useFlowSignals`: holds
`messages`, `open`, `loading`; `sendMessage()` appends the user msg, opens an empty assistant msg,
accumulates streamed `text`/`tool` events into it, and reads `getChatModel()` to pass `model` into
`streamChat`. Persists `messages` + a generated `session_id` to `localStorage` (`ai-chat-messages`,
`ai-chat-session`). `clear()` resets.

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

1. **Setup:** add `OPENROUTER_API_KEY` + valid `FLASH_ALPHA_API_KEY` to `backend/.env` (optionally
   `OPENROUTER_MODEL`, `LOGFIRE_TOKEN`); `uv sync`.
2. **Backend smoke:** `uv run uvicorn backend.main:app --reload --port 8000`, then
   `curl -N -X POST localhost:8000/api/chat/stream -H 'content-type: application/json' -d
   '{"session_id":"t1","messages":[{"role":"user","content":"what is the spx gex call wall"}]}'`
   → expect SSE `text` deltas naming the call-wall strike + a `tool` event for `get_gex`.
3. **Model-agnostic check:** change `OPENROUTER_MODEL` (e.g. to a different provider's slug),
   restart, re-run the curl → still answers correctly with no code change.
3b. **Settings override:** type a model slug into the Settings "AI Assistant" box, send a chat → the
   request uses that model (confirm via the model field in the request / Logfire model span); clear
   the box → falls back to the env default. Send a malformed slug → backend rejects it and falls back.
4. **Observability:** with `LOGFIRE_TOKEN` set, confirm Logfire shows a trace for the chat request
   with spans for the agent run, the `get_gex` tool call, the OpenRouter model request, the FlashAlpha
   httpx call, and token usage/cost. With the token unset, confirm chat still works (Logfire no-op).
5. **Frontend:** `cd frontend && npm run dev` → click the ✦ bubble, ask the question, confirm the
   answer streams in with a tool chip; refresh → history persists; navigate routes → widget stays.
6. **UI validation:** browser MCP per CLAUDE.md (open widget, send prompt, screenshot).
7. **Guardrails:** exceed per-session cap → clean "limit reached"; unset `OPENROUTER_API_KEY` → clear
   503; force a FlashAlpha quota error → the model explains the rate limit rather than the stream dying.

## Out of scope (v1)

Hosted MCP endpoint wiring, per-user auth/keys, server-side conversation storage, a per-message model
picker in the chat widget (model is chosen in Settings or via env), a curated model dropdown / live
model list from the OpenRouter API (the Settings field is free text), multi-symbol dashboards from
chat, voice. More tools (DEX/VEX, volatility, 0DTE, max pain) are easy follow-ons — each is one
wrapper function once the agent works.
