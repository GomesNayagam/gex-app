# Plan: AI Chat Assistant ("Ask FlashAlpha") — revised to dynamic-tool agent

## Context

The GEX dashboard has rich data but no conversational entry point. We want a floating AI chat widget —
reachable from **any** route — where a trader asks plain-English questions ("what is the spx gex call
wall", "expected SPY close this week from the weekly GEX walls") and gets an answer grounded in **live**
FlashAlpha options data.

A **working prototype already exists** at `backend/flashalpha_agent.py`. It proves out the agent design
end-to-end with `agent.run(...)`. We **adopt that prototype as the basis** for the feature, superseding
the earlier "reuse the existing `FlashAlphaAdapter` + 3 hand-written tools" approach. This revision aligns
the plan with the prototype.

**What the prototype establishes (and we keep):**
- **Pydantic AI** drives the tool-use loop. Model = **`OpenAIChatModel`** + **`OpenAIProvider`** pointed
  at **OpenRouter** (`https://openrouter.ai/api/v1`), making the assistant **model-agnostic** (swap via
  one env value) and **cost-effective**.
- **Dynamic tool generation**: a single `ENDPOINT_SPEC` list (16 FlashAlpha endpoints) is turned into
  typed Pydantic AI tools at import time via `build_input_model()` + `make_tool_fn()`. Adding an
  endpoint = adding one dict entry, no new function.
- **Direct `httpx`** to FlashAlpha with `X-Api-Key`, via Pydantic AI **dependency injection**
  (`FlashAlphaDeps` carries the API key per run). This is independent of the dashboard's
  `FlashAlphaAdapter`, so the agent reaches all 16 endpoints (quote, summary, gex, levels, exposure,
  narrative, 0DTE, max-pain, greeks, IV, volatility, dex/vex/chex, symbols, account).

**Decisions:**
- Data access = **direct httpx dynamic tools** (the prototype approach), not the adapter.
- Default model = **`deepseek/deepseek-v4-flash`** (prototype slug; cheap, good tool-calling).
  *Verify it is a current OpenRouter model id at execution time — a stale slug fails the first request.*
  Overridable with **zero code change** via `OPENROUTER_MODEL` env and a per-user Settings override.
- Code organization = **single `backend/services/chat.py`** that folds in the prototype's `ENDPOINT_SPEC`,
  builders, agent construction, **and** the streaming wrapper. `backend/flashalpha_agent.py` is the
  reference prototype; its logic migrates into `services/chat.py` (proper `backend.config` import).
- Tool scope = **all 16 endpoints registered, with graceful errors** — each generated tool catches
  HTTP/quota errors (incl. plan-gated 4xx on dex/vex/chex) and returns them **as a string tool result**
  so the model explains the limit instead of the stream dying.
- LLM streaming = **`agent.run_stream()` / `agent.iter()`** mapped to SSE (prototype used non-streaming
  `agent.run()`; we add streaming for the UI).
- Observability = **Pydantic Logfire**, gated on `LOGFIRE_TOKEN` (no-op when unset).
- Per-user model override lives in **Settings** (localStorage, rides in the chat request body).
- Scope = streaming + persisted history + abuse guardrails + suggested prompts.

## Dependency / config state (already in place)

- `pyproject.toml` already pins **`pydantic-ai>=1.104.0`** and **`logfire>=4.34.0`** — no `uv add` step.
  Run `uv sync` to ensure the venv is current. No `anthropic`/`openai` SDK needed.
- `backend/config.py` already has **`openrouter_api_key`** and **`flash_alpha_api_key`**. The FlashAlpha
  key is reused as-is for the agent's `X-Api-Key`.

## Architecture

```
Browser ChatWidget ──POST /api/chat/stream (SSE)──▶ FastAPI chat router
                                                        │
                                                        ▼
                                              services/chat.py
                           Pydantic AI Agent  (OpenAIChatModel → OpenRouter)
                           ENDPOINT_SPEC → dynamic @agent.tool ×16
                           deps = FlashAlphaDeps(api_key=settings.flash_alpha_api_key)
                                             │
                          each tool: httpx.AsyncClient.get(FLASHALPHA_BASE+path,
                                       headers={"X-Api-Key": deps.api_key})
                                             │
                                   Logfire instrumentation
                            (agent runs, tool calls, model spans, httpx, token cost)
```

**Tool-use loop:** Pydantic AI runs it internally — model emits a tool call → framework invokes the
matching generated tool → feeds the JSON result back → continues until a final text answer (capped by
`chat_max_tokens` / `chat_max_tool_iterations`). We stream via Pydantic AI's streaming API and translate
its events to the **same SSE shapes** the frontend expects, so the browser contract is unchanged.

## Backend changes

### `backend/services/chat.py` (new — the core; migrates the prototype)

Port `backend/flashalpha_agent.py` into the service layer with these adaptations:

1. **Imports / config**: `from backend.config import settings` (prototype used `from config import settings`
   — wrong for repo-root launch). Derive the model and FlashAlpha base from settings, not module constants:
   - `OPENROUTER_MODEL = settings.openrouter_model` (new setting, default `deepseek/deepseek-v4-flash`).
   - `FLASHALPHA_BASE`: the prototype's `ENDPOINT_SPEC` paths already include their own prefixes
     (`/v1/exposure/...`, `/stockquote/...` with **no** `/v1`, `/v1/symbols`), so the base must be the
     **bare host** `https://lab.flashalpha.com` (NOT the config's `.../v1`). Add a module constant
     `FLASHALPHA_BASE = "https://lab.flashalpha.com"` and keep the spec paths verbatim. **Do not** derive
     it via `settings.flash_alpha_base_url.rstrip("/v1")` — `str.rstrip` strips the char *set* `{/,v,1}`,
     not the suffix; if derivation is wanted use `.removesuffix("/v1")`. *Verify the joined URLs at
     execution against the prototype's working calls.*
2. **Model construction**: keep `OpenAIChatModel(OPENROUTER_MODEL, provider=OpenAIProvider(base_url=
   settings.openrouter_base_url, api_key=settings.openrouter_api_key))`. Build models **lazily** (function
   that returns/caches an agent) so an unset `openrouter_api_key` yields a clean 503 instead of an import
   crash. *Verify whether the installed Pydantic AI ships a dedicated `OpenRouterProvider`; if so prefer it,
   else the `OpenAIProvider(base_url=...)` form above (what the prototype uses) is the stable fallback.*
3. **`ENDPOINT_SPEC`, `build_input_model()`, `make_tool_fn()`, `FlashAlphaDeps`**: copy verbatim from the
   prototype (all 16 endpoints, dynamic builder, deps model).
4. **Graceful tool errors**: wrap the `httpx` call body in `make_tool_fn` so `httpx.HTTPStatusError` /
   timeouts / quota (429) / plan-gated (4xx on dex/vex/chex) are caught and **returned as a string**
   (e.g. `{"error": "..."}` or a plain message) rather than raised — the model then explains the limit and
   the SSE stream stays alive.
5. **Agent**: `agent = Agent(model, deps_type=FlashAlphaDeps, system_prompt=...)` then the
   `for spec in ENDPOINT_SPEC: agent.tool(make_tool_fn(...))` loop. Tighten the system prompt: terse
   options-analyst persona, "use tools for any live data, never invent numbers," include today's date.
6. **Streaming entrypoint** (new vs prototype): `async def stream_chat(messages, model: str | None = None)
   -> AsyncIterator[event]`:
   - `deps = FlashAlphaDeps(api_key=settings.flash_alpha_api_key)`.
   - **Message-history mapping** (the prototype only ever runs a single string): convert the incoming
     `[{role, content}]` array to Pydantic AI's typed `message_history: list[ModelMessage]` and pass the
     **latest user turn** as `user_prompt` — `run_stream()` does not accept raw role/content dicts.
     *Verify the exact `ModelMessage`/`ModelRequest`/`ModelResponse` constructors against
     `pydantic-ai>=1.104.0` at execution time.*
   - Run with Pydantic AI's streaming API (`agent.run_stream(...)` or `agent.iter(...)`); when `model` is
     supplied (Settings override) pass it for this run (per-run model, or build an `OpenAIChatModel` on the
     fly with the same OpenRouter provider); else use the env default.
   - Map framework events → `{type:"text",delta}`, `{type:"tool",name}`, `{type:"error",message}`,
     `{type:"done"}`. Pydantic AI owns the tool loop, so no hand-written iterate-until-final logic.
   - Enforce `chat_max_tokens` / `chat_max_tool_iterations` via agent run settings.
   - *Verify the exact streaming event API / model-per-run override against the installed
     `pydantic-ai>=1.104.0` at execution time.*

### `backend/config.py` — add settings

- `openrouter_base_url: str = "https://openrouter.ai/api/v1"`
- `openrouter_model: str = "deepseek/deepseek-v4-flash"` — **verify current OpenRouter slug at execution.**
- `logfire_token: Optional[str] = None` · `logfire_service_name: str = "gex-chat"`
- `chat_max_messages_per_session: int = 30` · `chat_max_tokens: int = 2048` · `chat_max_tool_iterations: int = 6`

(`openrouter_api_key` and `flash_alpha_api_key` already exist.)

### `backend/routers/chat.py` (new) — `APIRouter(prefix="/api", tags=["Chat"])`

- `POST /api/chat/stream` → `StreamingResponse(media_type="text/event-stream")` driving `chat.stream_chat`.
  Body: `{session_id, messages:[{role, content}], model?}`.
- Validate the optional `model`: non-empty, length-capped (≤ ~100 chars), matches `^[\w./:-]+$`; on
  malformed input fall back to the env default rather than forwarding arbitrary client text to OpenRouter.
- Guardrails: in-memory `dict[session_id -> count]`, reject past `chat_max_messages_per_session` with a
  clean SSE error event; cap dict size so it can't grow unbounded. Return **503** (clear message) if
  `openrouter_api_key` — or `flash_alpha_api_key` (the agent's data source) — is unset, rather than
  letting every tool fail mid-stream.

### `backend/main.py` — wire router + Logfire

- `from backend.routers import chat` + `app.include_router(chat.router)` (CORS already permissive).
- Logfire setup in the lifespan/startup (or a small `services/observability.py`), guarded so it is a
  **no-op when `LOGFIRE_TOKEN` is unset** (mirror the app's existing optional-key pattern):
  `logfire.configure(token=..., service_name=...)`, `logfire.instrument_pydantic_ai()`,
  `logfire.instrument_fastapi(app)`, `logfire.instrument_httpx()` so the FlashAlpha httpx calls and the
  agent run share one trace.

### `backend/.env.example` — document `OPENROUTER_API_KEY` (+ optional `OPENROUTER_MODEL`, `LOGFIRE_TOKEN`)

`.env` stays gitignored. Existing `FLASH_ALPHA_API_KEY` reused as-is.

## Frontend changes

The SSE event contract (`text` / `tool` / `error` / `done`) is unchanged. All under existing conventions
(CSS vars, IBM Plex Mono, `cn()`, `lucide-react`, `@/` alias). Widget mounts in
**`components/shell/AppShell.jsx`** so it renders once on every route.

- **`frontend/src/lib/chatSettings.js`** (new) — mirror `lib/refreshSettings.js`: `getChatModel()` /
  `setChatModel(str)` over localStorage key `ai-chat-model`; returns `""` (= server default) when unset.
- **`frontend/src/views/Settings.jsx`** — add an **"AI Assistant"** `<section>` (same markup idiom as the
  Theme / Refresh sections) with a text `<input>` bound to `getChatModel()` / `setChatModel()`.
  Placeholder = server default slug (`deepseek/deepseek-v4-flash`); helper: "OpenRouter model slug, e.g.
  `anthropic/claude-sonnet-4-5`. Blank = server default. See openrouter.ai/models."
- **`frontend/src/api.js`** — add `streamChat({sessionId, messages, model}, onEvent)` using `fetch` +
  `response.body.getReader()` to parse SSE (EventSource can't POST a body). Include `model` only when non-empty.
- **`frontend/src/hooks/useAIChat.js`** (new) — mirror `useFlowSignals`/`useSidebar`: holds `messages`,
  `open`, `loading`; `sendMessage()` appends user msg, opens an empty assistant msg, accumulates
  `text`/`tool` events, reads `getChatModel()` for the `model` arg. Persists `messages` + generated
  `session_id` to localStorage (`ai-chat-messages`, `ai-chat-session`); `clear()` resets.
- **`frontend/src/components/ai/ChatWidget.jsx`** (new) — floating round button (`fixed bottom-right z-50`,
  `--blue` accent, Sparkles icon) → ~380px panel reusing the existing drawer/overlay pattern (fixed panel +
  `bg-black/30` backdrop, close on backdrop/✕). Empty state shows suggested prompts ("SPX gamma flip?",
  "QQQ put wall?", "SPY 0DTE pin risk?"). Scrollable message list + sticky input.
- **`frontend/src/components/ai/ChatMessage.jsx`** (new) — user bubble (right, `--surface-2`) vs assistant
  (left); small "⛁ via `get_gex`" tool chip when a tool ran; spinner while streaming.
- **`frontend/src/components/ai/ChatInput.jsx`** (new) — textarea + send (Enter sends, Shift+Enter newline);
  disabled while `loading`.

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

## Cleanup

Once `services/chat.py` is working, **delete `backend/flashalpha_agent.py`** (its logic now lives in the
service) — or leave a one-line comment pointing to the service.

## Verification (end-to-end)

1. **Setup:** `OPENROUTER_API_KEY` + valid `FLASH_ALPHA_API_KEY` in `backend/.env` (optionally
   `OPENROUTER_MODEL`, `LOGFIRE_TOKEN`); `uv sync`.
2. **Prototype sanity (pre-port):** confirm the existing prototype still runs against the live API by
   temporarily running its `main()` (it already exercises the agent + tools) — this validates the model
   slug and FlashAlpha URLs before porting.
3. **Backend smoke:** `uv run uvicorn backend.main:app --reload --port 8000`, then
   `curl -N -X POST localhost:8000/api/chat/stream -H 'content-type: application/json' -d
   '{"session_id":"t1","messages":[{"role":"user","content":"what is the spx gex call wall"}]}'`
   → expect SSE `text` deltas naming the call-wall strike + a `tool` event (e.g. `get_gex`).
4. **Model-agnostic check:** change `OPENROUTER_MODEL` to a different provider slug, restart, re-run the
   curl → still answers, no code change.
5. **Settings override:** type a slug in the Settings "AI Assistant" box → request uses it (confirm via
   Logfire model span); clear → falls back to env default; malformed slug → backend rejects, falls back.
6. **Graceful tool errors:** ask for a plan-gated metric (e.g. DEX on a Free key) → the model reports the
   limit; the stream completes with `done`, no crash.
7. **Observability:** with `LOGFIRE_TOKEN` set, confirm a trace with spans for the agent run, the tool
   call, the OpenRouter request, the FlashAlpha httpx call, and token usage/cost. Unset → chat still works.
8. **Frontend:** `cd frontend && npm run dev` → click ✦, ask the question, answer streams with a tool chip;
   refresh → history persists; navigate routes → widget stays. Validate via browser MCP per CLAUDE.md.
9. **Guardrails:** exceed per-session cap → clean "limit reached"; unset `OPENROUTER_API_KEY` → clear 503.

## Out of scope (v1)

Hosted MCP endpoint wiring, per-user auth/keys, server-side conversation storage, a per-message model
picker in the widget, a curated model dropdown / live OpenRouter model list (Settings field is free text),
multi-symbol dashboards from chat, voice. (Adding/removing a FlashAlpha endpoint is a one-line
`ENDPOINT_SPEC` change.)
