# Multi-Agent Chat Design

## Problem

The current AI chat (`backend/services/chat.py`, `backend/routers/chat.py`) runs a single PydanticAI `Agent` with all 16 FlashAlpha endpoints registered as dynamically-generated tools, sharing one broad system prompt. This:

- Forces one model to juggle tool selection across very different domains (gamma exposure, volatility, market structure/pricing), diluting prompt focus and tool-choice accuracy.
- Handles multi-domain questions ("compare SPX gamma regime to QQQ volatility skew and suggest a trade") by sequentially calling tools one at a time inside a single agent loop — slower and harder to reason about than running independent specialists concurrently.
- Gives the user no visibility into _how_ the answer was assembled — `toolNames` is tracked per assistant message in `useAISessions.js` but never rendered in `ChatMessage.jsx`.

## Goals

1. Improve answer quality on complex/multi-domain questions via domain-specialized agents.
2. Run independent specialist work in parallel rather than sequentially.
3. Make the multi-agent collaboration visible in the chat UI — a lightweight "agent trace" the user can inspect, not a dump of raw reasoning.
4. Keep the roster of specialists and their tool groupings easy to extend later without touching orchestration, streaming, or frontend code.

## Architecture

### Orchestrator + registry-driven specialists

A new **orchestrator agent** sits in front of the existing tool surface. It has no FlashAlpha tools of its own — its only job is to read the user's question, decide which specialist(s) are relevant, delegate to them (in parallel where possible), and synthesize their findings into one coherent, leveled response. Every question — simple or complex — routes through exactly one or more specialists; the orchestrator never calls FlashAlpha directly. This keeps the architecture uniform: one code path, one mental model.

Specialists are declared in a new data structure, `SPECIALIST_REGISTRY`, alongside the existing `ENDPOINT_SPEC` in `backend/services/chat.py`:

```python
SPECIALIST_REGISTRY: list[dict] = [
    {
        "name": "exposure",
        "label": "Exposure Agent",
        "description": "Gamma/delta/vanna/charm exposure, key levels, dealer positioning.",
        "system_prompt": "...",
        "tool_names": ["get_gex", "get_key_levels", "get_exposure_summary",
                       "get_dex", "get_vex", "get_chex"],
    },
    {
        "name": "volatility",
        "label": "Volatility Agent",
        "description": "IV/HV, skew, term structure, greeks, stock summary.",
        "system_prompt": "...",
        "tool_names": ["get_volatility_analysis", "get_bsm_greeks",
                       "get_implied_vol", "get_stock_summary"],
    },
    {
        "name": "market_structure",
        "label": "Market Structure Agent",
        "description": "Quotes, narrative, 0DTE analytics, max pain, symbols, account.",
        "system_prompt": "...",
        "tool_names": ["get_stock_quote", "get_narrative", "get_zero_dte",
                       "get_max_pain",],
    },
]
```

A builder function loops over the registry, looks up each `tool_name` in `ENDPOINT_SPEC`, and constructs a specialist `Agent` using the existing `_build_input_model`/`_make_tool_fn` machinery (unchanged). Adding a 4th specialist or re-grouping endpoints is a registry edit only — no orchestration, streaming, or frontend changes required, mirroring how `ENDPOINT_SPEC` already drives dynamic tool generation today.

### Delegation as tools

Each specialist is exposed to the orchestrator as a delegation tool, e.g. `delegate_to_exposure_agent(query: str) -> str`. The wrapper:

1. Runs the specialist via `agent.iter(query, deps=deps)`.
2. Forwards the specialist's streaming events (text deltas, tool calls, completion) — tagged with the specialist's `name` — onto a shared `asyncio.Queue` consumed by the SSE layer (see Streaming below).
3. Returns the specialist's final text output as the tool result, which the orchestrator uses for synthesis.

The orchestrator's system prompt instructs it to: identify which domain(s) the question touches, delegate to the corresponding specialist(s) (calling more than one in the same turn when the question spans domains), wait for their findings, and produce one synthesized, leveled answer — never inventing data itself.

### Parallel execution

When the orchestrator's model emits multiple delegation tool-calls in a single turn (e.g., both `delegate_to_exposure_agent` and `delegate_to_volatility_agent` for a cross-domain question), PydanticAI's `CallToolsNode` already executes concurrent tool calls together. No custom scheduling is needed — parallelism falls out of the existing agent loop simply by registering multiple delegation tools.

### Streaming: unifying orchestrator + specialist events

Today, `stream_chat` iterates a single agent's run and emits SSE frames directly. With delegation, specialist events arrive _during_ a tool call, nested inside the orchestrator's run. To keep ordering and avoid blocking:

- `stream_chat` creates one shared `asyncio.Queue`.
- The orchestrator's `agent.iter()` consumption runs as a background task; as it produces text deltas / tool-call events, it pushes them onto the queue tagged `agent: "orchestrator"`.
- Each delegation wrapper does the same for its specialist's events, tagged with that specialist's `name`.
- The main `stream_chat` loop simply drains the shared queue and emits SSE frames — unifying both levels into one ordered stream, terminating when the orchestrator's run completes and the queue is empty.

New SSE event shape (additive — existing `text`/`error`/`done` frames at the top level are unchanged and continue to represent the orchestrator's final synthesized answer):

```json
{"type": "agent_event", "agent": "exposure", "kind": "start"}
{"type": "agent_event", "agent": "exposure", "kind": "tool", "name": "get_gex"}
{"type": "agent_event", "agent": "exposure", "kind": "text", "delta": "..."}
{"type": "agent_event", "agent": "exposure", "kind": "done", "summary": "..."}
```

### Frontend: agent trace UI

Extend the assistant message model (built up in `useAISessions.js`, alongside the existing `toolNames` accumulation) with:

```js
subAgents: [
  { name: "exposure", label: "Exposure Agent", status: "running"|"done", toolNames: [...], summary: "..." },
  ...
]
```

populated incrementally as `agent_event` frames of `kind: start|tool|done` arrive.

In `ChatMessage.jsx`, render a collapsible **"Agent trace"** section inside the assistant's message bubble — collapsed by default — listing each specialist with: a status indicator (running/done), the tools it called, and a short one-line summary of its findings. The orchestrator's synthesized answer (the existing `message.content` markdown) remains the primary, always-visible content; the trace is purely an optional "show your work" affordance for users who want to see how the answer was assembled.

## Error Handling

- If a specialist run fails, its delegation tool returns a structured `{"error": "..."}` string (mirroring the existing per-tool error handling in `_make_tool_fn`) so the orchestrator can acknowledge the gap in its synthesis rather than failing the whole turn.
- If the orchestrator itself fails to initialize or run, the existing top-level `error`/`done` SSE frames in `stream_chat` continue to handle that — unchanged from today.

## Testing

- Unit-test the registry builder: each `tool_name` in `SPECIALIST_REGISTRY` resolves to an entry in `ENDPOINT_SPEC`, and each specialist agent is constructed with the right tool subset.
- Integration-test `stream_chat` with a mocked orchestrator that delegates to two specialists concurrently — assert the SSE stream contains correctly-tagged `agent_event` frames interleaved with the final orchestrator `text`/`done` frames, in a valid order (specialist `start` before its `tool`/`text`/`done`).
- Frontend: verify `useAISessions.js` correctly accumulates `subAgents` from `agent_event` frames, and that `ChatMessage.jsx` renders the collapsed trace correctly for 0, 1, and multiple specialists.

## Out of Scope

- Dynamic/runtime agent spawning (the registry is a fixed, edit-to-extend list, not a runtime-configurable one).
- Sequential/adaptive chaining where one specialist's output feeds another's input — all delegation in this design is "fan out, then synthesize."
- Persisting agent-trace data beyond the current session (no new backend storage).
