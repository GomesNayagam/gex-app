# Multi-Agent Chat Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single broad-prompt FlashAlpha chat agent with an orchestrator that delegates to domain-specialist agents (exposure, volatility, market structure), running them in parallel and surfacing their work as a collapsible "agent trace" in the chat UI.

**Architecture:** `backend/services/chat.py` gains a `SPECIALIST_REGISTRY`, builders for cached specialist agents, an orchestrator agent whose only tools are delegation wrappers, and a rewritten `stream_chat` that drains a shared `asyncio.Queue` fed by the orchestrator's run (background task) and by each delegation wrapper (which streams its specialist's `agent.iter()` and tags events with `agent: <name>`). The frontend (`useAISessions.js`, `ChatMessage.jsx`) accumulates and renders these tagged `agent_event` SSE frames as a per-message trace.

**Tech Stack:** Python 3.11, FastAPI, PydanticAI 1.104 (`Agent`, `RunContext`, `agent.iter`, `FunctionModel`/`TestModel` for tests), `asyncio.Queue`; React 18, `useAISessions` hook, SSE via `fetch` + `ReadableStream`.

---

## File Structure

- Modify `backend/services/chat.py` — add `SPECIALIST_REGISTRY`, `OrchestratorDeps`, specialist/orchestrator builders + caches, delegation tool factory, rewritten `stream_chat`. Remove the now-unused single-agent builder (`_build_agent`, `_get_agent`, `_agents`).
- Create `backend/tests/__init__.py`, `backend/tests/test_chat_specialists.py` — registry-resolution unit test + `stream_chat` integration test using `FunctionModel`/`TestModel` mocks (no live API calls).
- Modify `pyproject.toml` — add `pytest`, `pytest-asyncio` as dev dependencies (none exist yet).
- Modify `frontend/src/hooks/useAISessions.js` — accumulate `subAgents` on the streaming assistant message from `agent_event` frames.
- Modify `frontend/src/components/ai/ChatMessage.jsx` — render a collapsible "Agent trace" section listing each sub-agent's status, tools, and summary.

---

## Task 1: Add `OrchestratorDeps` and `SPECIALIST_REGISTRY`

**Files:**

- Modify: `backend/services/chat.py:173-175` (right after `FlashAlphaDeps`)

- [ ] **Step 1: Add `OrchestratorDeps` and the registry data structure**

Insert immediately after the `FlashAlphaDeps` class definition (currently lines 173-175):

```python
class OrchestratorDeps(BaseModel):
    """Deps for the orchestrator agent — carries the FlashAlpha key for
    delegated specialist runs and the shared SSE event queue (set per-request)."""

    model_config = {"arbitrary_types_allowed": True}

    api_key: Optional[str] = None
    event_queue: Any = None  # asyncio.Queue, injected by stream_chat per request


_ORCHESTRATOR_PROMPT_TEMPLATE = (
    "You are the option GEX Quant Analyst Orchestrator (today: {today}), coordinating a team of "
    "domain-specialist agents over live FlashAlpha options data. "
    "You have NO direct data tools of your own — you can only delegate. Specialists:\n"
    "{roster}\n"
    "Rules: "
    "1. Read the user's question and identify which specialist domain(s) it touches. "
    "2. Delegate to the relevant specialist(s) by calling their delegation tool with a "
    "focused sub-question — call more than one in the same turn when the question spans "
    "domains (e.g. both exposure and volatility for a cross-domain ask). "
    "3. Wait for all delegated findings, then produce ONE synthesized, leveled answer in "
    "clean markdown — never invent data yourself, only restate and connect what the "
    "specialists reported. "
    "4. NEVER start your response with 'I', 'Let me', 'Me', or any first-person preamble "
    "— go straight to the synthesis. "
    "5. Use ## headers, **bold** key values, and tables when comparing across domains. "
    "6. If a specialist reports an error, acknowledge the gap honestly rather than "
    "inventing a substitute answer for that domain."
)

_SPECIALIST_PROMPT_TEMPLATE = (
    "You are the {label}, a specialist in {description} (today: {today}). "
    "Rules: "
    "1. Always call the relevant tool before answering any market question — never invent "
    "numbers. "
    "2. Be concise and data-driven: lead with the most actionable number or level, then "
    "context. "
    "3. Respond as plain, dense findings (no markdown headers, no greeting, no "
    "first-person preamble) — your output is consumed by another agent for synthesis, "
    "not shown directly to the end user."
)


def _specialist_system_prompt(spec: dict) -> str:
    return _SPECIALIST_PROMPT_TEMPLATE.format(
        label=spec["label"], description=spec["description"], today=date.today().isoformat()
    )


def _orchestrator_system_prompt() -> str:
    roster = "\n".join(
        f"- {spec['label']} (`delegate_to_{spec['name']}_agent`): {spec['description']}"
        for spec in SPECIALIST_REGISTRY
    )
    return _ORCHESTRATOR_PROMPT_TEMPLATE.format(today=date.today().isoformat(), roster=roster)


SPECIALIST_REGISTRY: list[dict] = [
    {
        "name": "exposure",
        "label": "Exposure Agent",
        "description": "gamma/delta/vanna/charm exposure, key options-derived levels, and dealer positioning",
        "tool_names": [
            "get_gex", "get_key_levels", "get_exposure_summary",
            "get_dex", "get_vex", "get_chex",
        ],
    },
    {
        "name": "volatility",
        "label": "Volatility Agent",
        "description": "implied/realized volatility, skew, term structure, options pricing greeks, and stock summaries",
        "tool_names": [
            "get_volatility_analysis", "get_bsm_greeks",
            "get_implied_vol", "get_stock_summary",
        ],
    },
    {
        "name": "market_structure",
        "label": "Market Structure Agent",
        "description": "live quotes, options-flow narrative, 0DTE dynamics, max pain, available symbols, and account status",
        "tool_names": [
            "get_stock_quote", "get_narrative", "get_zero_dte",
            "get_max_pain"
        ],
    },
]
```

Note: `Any` is already imported on line 9 (`from typing import Any, AsyncIterator, Optional`); no new imports needed for this step.

- [ ] **Step 2: Verify the module still imports cleanly**

Run: `uv run python -c "from backend.services import chat; print(len(chat.SPECIALIST_REGISTRY))"`
Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat.py
git commit -m "feat: add specialist registry and orchestrator deps to chat service"
```

---

## Task 2: Build cached specialist agents from the registry

**Files:**

- Modify: `backend/services/chat.py` (replace the single-agent builder block, currently `_build_agent`/`_agents`/`_get_agent`, lines 230-263)

- [ ] **Step 1: Replace `_build_agent`/`_agents`/`_get_agent` with specialist builders + cache**

Replace the entire block from `def _build_agent(model_name: str) -> Agent:` through `def _get_agent(model_name: str) -> Agent:` / its body (original lines 230-263) with:

```python
_ENDPOINT_BY_NAME: dict[str, dict] = {spec["name"]: spec for spec in ENDPOINT_SPEC}


def _build_specialist_agent(spec: dict, model_name: str) -> Agent:
    model = OpenAIChatModel(
        model_name,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    a = Agent(
        model,
        deps_type=FlashAlphaDeps,
        system_prompt=_specialist_system_prompt(spec),
    )
    for tool_name in spec["tool_names"]:
        endpoint = _ENDPOINT_BY_NAME[tool_name]
        input_model = _build_input_model(endpoint)
        a.tool(_make_tool_fn(endpoint, input_model))
    return a


# Module-level specialist agent cache: key = (specialist_name, model_name)
_specialist_agents: dict[tuple[str, str], Agent] = {}


def _get_specialist_agent(name: str, model_name: str) -> Agent:
    key = (name, model_name)
    if key not in _specialist_agents:
        spec = next(s for s in SPECIALIST_REGISTRY if s["name"] == name)
        _specialist_agents[key] = _build_specialist_agent(spec, model_name)
    return _specialist_agents[key]
```

- [ ] **Step 2: Verify each registry tool name resolves and a specialist agent builds with the right tools**

Run:

```bash
uv run python -c "
from backend.services import chat
for spec in chat.SPECIALIST_REGISTRY:
    for name in spec['tool_names']:
        assert name in chat._ENDPOINT_BY_NAME, name
    a = chat._build_specialist_agent(spec, 'openai/gpt-4o-mini')
    tools = set(a._function_toolset.tools.keys())
    assert tools == set(spec['tool_names']), (spec['name'], tools)
    print(spec['name'], 'OK', sorted(tools))
"
```

Expected: prints `exposure OK [...]`, `volatility OK [...]`, `market_structure OK [...]` with no `AssertionError`.

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat.py
git commit -m "feat: build cached specialist agents from SPECIALIST_REGISTRY"
```

---

## Task 3: Delegation tool factory (specialist run → tagged queue events)

**Files:**

- Modify: `backend/services/chat.py` (insert after the specialist cache added in Task 2)

- [ ] **Step 1: Add `_make_delegation_tool`**

Insert directly after `_get_specialist_agent`:

```python
def _make_delegation_tool(spec: dict, model_name: str):
    """Build an orchestrator tool that runs the named specialist, forwarding its
    streamed events (tagged with the specialist's name) onto the shared queue in
    `ctx.deps.event_queue`, and returning its final text as the tool result."""

    async def delegate_fn(ctx: RunContext[OrchestratorDeps], query: str) -> str:
        queue = ctx.deps.event_queue
        agent = _get_specialist_agent(spec["name"], model_name)
        deps = FlashAlphaDeps(api_key=ctx.deps.api_key)
        tag = spec["name"]

        await queue.put({"type": "agent_event", "agent": tag, "kind": "start"})
        try:
            async with agent.iter(query, deps=deps) as run:
                async for node in run:
                    if isinstance(node, End):
                        break
                    if isinstance(node, ModelRequestNode):
                        async with node.stream(run.ctx) as agent_stream:
                            async for event in agent_stream:
                                if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                    await queue.put({
                                        "type": "agent_event", "agent": tag,
                                        "kind": "text", "delta": event.delta.content_delta,
                                    })
                    elif isinstance(node, CallToolsNode):
                        async with node.stream(run.ctx) as events:
                            async for event in events:
                                if isinstance(event, FunctionToolCallEvent):
                                    await queue.put({
                                        "type": "agent_event", "agent": tag,
                                        "kind": "tool", "name": event.part.tool_name,
                                    })
                output = run.result.output if run.result else ""
        except Exception:
            logger.exception("Specialist %s failed", tag)
            await queue.put({"type": "agent_event", "agent": tag, "kind": "done", "summary": "Failed to complete"})
            return json.dumps({"error": f"{spec['label']} failed to complete its analysis"})

        summary = (output or "").strip().replace("\n", " ")[:200]
        await queue.put({"type": "agent_event", "agent": tag, "kind": "done", "summary": summary})
        return output

    delegate_fn.__name__ = f"delegate_to_{spec['name']}_agent"
    delegate_fn.__doc__ = (
        f"Delegate to the {spec['label']}, a specialist in {spec['description']}. "
        "Pass a focused sub-question covering only what this specialist should answer."
    )
    return delegate_fn
```

- [ ] **Step 2: Verify it imports and produces a correctly named/documented tool**

Run:

```bash
uv run python -c "
from backend.services import chat
spec = chat.SPECIALIST_REGISTRY[0]
fn = chat._make_delegation_tool(spec, 'openai/gpt-4o-mini')
assert fn.__name__ == 'delegate_to_exposure_agent', fn.__name__
assert 'Exposure Agent' in fn.__doc__
print('OK', fn.__name__)
"
```

Expected: `OK delegate_to_exposure_agent`

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat.py
git commit -m "feat: add delegation tool factory that streams tagged specialist events"
```

---

## Task 4: Build the orchestrator agent (replaces the single-agent cache)

**Files:**

- Modify: `backend/services/chat.py` (insert after `_make_delegation_tool`, before `_convert_history`)

- [ ] **Step 1: Add `_build_orchestrator_agent` + cache**

```python
def _build_orchestrator_agent(model_name: str) -> Agent:
    model = OpenAIChatModel(
        model_name,
        provider=OpenRouterProvider(api_key=settings.openrouter_api_key),
    )
    a = Agent(
        model,
        deps_type=OrchestratorDeps,
        system_prompt=_orchestrator_system_prompt(),
    )
    for spec in SPECIALIST_REGISTRY:
        a.tool(_make_delegation_tool(spec, model_name))
    return a


# Module-level orchestrator agent cache: key = model_name
_orchestrators: dict[str, Agent] = {}


def _get_orchestrator(model_name: str) -> Agent:
    if model_name not in _orchestrators:
        _orchestrators[model_name] = _build_orchestrator_agent(model_name)
    return _orchestrators[model_name]
```

- [ ] **Step 2: Verify the orchestrator builds with exactly the three delegation tools**

Run:

```bash
uv run python -c "
from backend.services import chat
a = chat._get_orchestrator('openai/gpt-4o-mini')
tools = set(a._function_toolset.tools.keys())
assert tools == {'delegate_to_exposure_agent', 'delegate_to_volatility_agent', 'delegate_to_market_structure_agent'}, tools
print('OK', sorted(tools))
"
```

Expected: `OK ['delegate_to_exposure_agent', 'delegate_to_market_structure_agent', 'delegate_to_volatility_agent']`

- [ ] **Step 3: Commit**

```bash
git add backend/services/chat.py
git commit -m "feat: build orchestrator agent with delegation-only tool surface"
```

---

## Task 5: Rewrite `stream_chat` around the shared queue

**Files:**

- Modify: `backend/services/chat.py:286-343` (the entire `stream_chat` function body)

- [ ] **Step 1: Add the `asyncio` import**

At the top of the file, line 6 currently reads `import json`. Change the import block (lines 6-9) to add `asyncio`:

```python
import asyncio
import json
import logging
from datetime import date
from typing import Any, AsyncIterator, Optional
```

- [ ] **Step 2: Replace the body of `stream_chat`**

Replace the whole function (original lines 286-343) with:

```python
async def stream_chat(
    messages: list[dict],
    model: str | None = None,
) -> AsyncIterator[str]:
    """Stream SSE-encoded events for a chat turn.

    The orchestrator's run is driven as a background task that pushes its own
    events (and each delegated specialist pushes its own, tagged) onto one
    shared queue; this generator simply drains that queue in order.

    Yields newline-delimited `data: <json>\\n\\n` strings of the form:
        {type: "text", delta: "..."}                                   — orchestrator text
        {type: "tool", name: "delegate_to_exposure_agent"}             — orchestrator delegation call
        {type: "agent_event", agent: "exposure", kind: "start"}        — specialist lifecycle
        {type: "agent_event", agent: "exposure", kind: "tool", name}
        {type: "agent_event", agent: "exposure", kind: "text", delta}
        {type: "agent_event", agent: "exposure", kind: "done", summary}
        {type: "error", message: "..."}
        {type: "done"}
    """
    model_name = model or settings.openrouter_model
    user_prompt, history = _convert_history(messages)

    def _sse(payload: dict) -> str:
        return f"data: {json.dumps(payload)}\n\n"

    try:
        orchestrator = _get_orchestrator(model_name)
    except Exception:
        logger.exception("Agent init failed for model %s", model_name)
        yield _sse({"type": "error", "message": "Agent initialization failed"})
        yield _sse({"type": "done"})
        return

    queue: asyncio.Queue = asyncio.Queue()
    deps = OrchestratorDeps(api_key=settings.flash_alpha_api_key, event_queue=queue)
    _SENTINEL = object()

    async def _run_orchestrator() -> None:
        try:
            async with orchestrator.iter(
                user_prompt,
                message_history=history or None,
                deps=deps,
                model_settings={"max_tokens": settings.chat_max_tokens},
            ) as agent_run:
                async for node in agent_run:
                    if isinstance(node, End):
                        break

                    if isinstance(node, ModelRequestNode):
                        async with node.stream(agent_run.ctx) as agent_stream:
                            async for event in agent_stream:
                                if isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                                    await queue.put({"type": "text", "delta": event.delta.content_delta})

                    elif isinstance(node, CallToolsNode):
                        async with node.stream(agent_run.ctx) as events:
                            async for event in events:
                                if isinstance(event, FunctionToolCallEvent):
                                    await queue.put({"type": "tool", "name": event.part.tool_name})
        except Exception:
            logger.exception("Chat stream error")
            await queue.put({"type": "error", "message": "An error occurred while processing your request"})
        finally:
            await queue.put(_SENTINEL)

    task = asyncio.create_task(_run_orchestrator())
    try:
        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield _sse(item)
    finally:
        await task

    yield _sse({"type": "done"})
```

- [ ] **Step 3: Smoke-check the module still imports and the queue drains for a trivial run**

This won't hit the live model (no `OPENROUTER_API_KEY` needed for an import-level check), but confirms wiring:

```bash
uv run python -c "
import asyncio
from backend.services import chat
async def go():
    out = []
    async for frame in chat.stream_chat([{'role': 'user', 'content': 'hi'}], model='openai/gpt-4o-mini'):
        out.append(frame)
        if len(out) > 50:
            break
    print(out[:3])
asyncio.run(go())
" 2>&1 | tail -5
```

Expected: either a streamed `data: {"type": "error", ...}` / `data: {"type": "done"}` pair (if no live API key — that's fine, it proves the queue-drain path runs end-to-end and surfaces the error frame) or real `text`/`tool`/`agent_event` frames if keys are configured. Either way it must **not** raise a Python exception or hang.

- [ ] **Step 4: Commit**

```bash
git add backend/services/chat.py
git commit -m "feat: rewrite stream_chat to drain a shared queue fed by orchestrator and specialists"
```

---

## Task 6: Backend tests for the registry builder and the streamed trace

**Files:**

- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_chat_specialists.py`
- Modify: `pyproject.toml`

- [ ] **Step 1: Add pytest + pytest-asyncio as dev dependencies**

```bash
uv add --dev pytest pytest-asyncio
```

Expected: `pyproject.toml` gains a `[dependency-groups]` / `dev = [...]` entry with both packages, and `uv.lock` updates.

- [ ] **Step 2: Create the test package marker**

Create `backend/tests/__init__.py` (empty file).

- [ ] **Step 3: Write the failing tests**

Create `backend/tests/test_chat_specialists.py`:

```python
"""Tests for the multi-agent chat orchestration in backend/services/chat.py.

Uses PydanticAI's TestModel/FunctionModel so no live OpenRouter/FlashAlpha
calls are made.
"""

import asyncio

import pytest
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage, ModelResponse, TextPart, ToolCallPart
from pydantic_ai.models.function import AgentInfo, FunctionModel
from pydantic_ai.models.test import TestModel

from backend.services import chat


def test_registry_tool_names_resolve_to_endpoint_spec():
    for spec in chat.SPECIALIST_REGISTRY:
        for tool_name in spec["tool_names"]:
            assert tool_name in chat._ENDPOINT_BY_NAME, f"{tool_name} missing from ENDPOINT_SPEC"


def test_specialist_agent_has_exact_tool_subset():
    for spec in chat.SPECIALIST_REGISTRY:
        agent = chat._build_specialist_agent(spec, "openai/gpt-4o-mini")
        tool_names = set(agent._function_toolset.tools.keys())
        assert tool_names == set(spec["tool_names"]), (spec["name"], tool_names)


def test_orchestrator_has_one_delegation_tool_per_specialist():
    agent = chat._get_orchestrator("test-model-orchestrator-roster")
    tool_names = set(agent._function_toolset.tools.keys())
    expected = {f"delegate_to_{spec['name']}_agent" for spec in chat.SPECIALIST_REGISTRY}
    assert tool_names == expected


@pytest.mark.asyncio
async def test_stream_chat_emits_tagged_agent_events_for_parallel_delegation(monkeypatch):
    """Mock the orchestrator to delegate to two specialists in one turn, and
    each specialist to stream a bit of text, then verify stream_chat's SSE
    output contains correctly-tagged agent_event frames in valid order,
    interleaved with the orchestrator's final text/done frames."""

    # Specialists: TestModel with canned output text (each produces one text delta).
    exposure_spec = next(s for s in chat.SPECIALIST_REGISTRY if s["name"] == "exposure")
    volatility_spec = next(s for s in chat.SPECIALIST_REGISTRY if s["name"] == "volatility")

    exposure_agent = Agent(
        TestModel(custom_output_text="Gamma flip at 5500, dealers short gamma below."),
        deps_type=chat.FlashAlphaDeps,
        system_prompt=chat._specialist_system_prompt(exposure_spec),
    )
    volatility_agent = Agent(
        TestModel(custom_output_text="IV-RV spread is wide; skew is steep to the downside."),
        deps_type=chat.FlashAlphaDeps,
        system_prompt=chat._specialist_system_prompt(volatility_spec),
    )

    def fake_get_specialist_agent(name, model_name):
        return {"exposure": exposure_agent, "volatility": volatility_agent}[name]

    monkeypatch.setattr(chat, "_get_specialist_agent", fake_get_specialist_agent)

    # Orchestrator: FunctionModel that delegates to both specialists in turn 1,
    # then synthesizes in turn 2.
    call_count = {"n": 0}

    def orchestrator_fn(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
        call_count["n"] += 1
        if call_count["n"] == 1:
            return ModelResponse(parts=[
                ToolCallPart(tool_name="delegate_to_exposure_agent",
                             args={"query": "SPX gamma regime"}, tool_call_id="t1"),
                ToolCallPart(tool_name="delegate_to_volatility_agent",
                             args={"query": "SPX vol skew"}, tool_call_id="t2"),
            ])
        return ModelResponse(parts=[TextPart(content="Synthesized cross-domain answer.")])

    fake_orchestrator = Agent(
        FunctionModel(orchestrator_fn),
        deps_type=chat.OrchestratorDeps,
        system_prompt=chat._orchestrator_system_prompt(),
    )
    for spec in chat.SPECIALIST_REGISTRY:
        fake_orchestrator.tool(chat._make_delegation_tool(spec, "fake-model"))

    monkeypatch.setattr(chat, "_get_orchestrator", lambda model_name: fake_orchestrator)

    frames = []
    async for raw in chat.stream_chat([{"role": "user", "content": "compare SPX gamma and vol"}], model="fake-model"):
        assert raw.startswith("data: ") and raw.endswith("\n\n")
        frames.append(__import__("json").loads(raw[len("data: "):].strip()))

    # Must end with the orchestrator's synthesized text and a top-level done frame.
    assert frames[-1] == {"type": "done"}
    assert any(f.get("type") == "text" and "Synthesized cross-domain answer" in f.get("delta", "") for f in frames)

    # Each specialist must report start before its done, and a summary on done.
    for tag in ("exposure", "volatility"):
        agent_frames = [f for f in frames if f.get("type") == "agent_event" and f.get("agent") == tag]
        kinds = [f["kind"] for f in agent_frames]
        assert kinds[0] == "start", (tag, kinds)
        assert kinds[-1] == "done", (tag, kinds)
        assert agent_frames[-1]["summary"], tag
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest backend/tests/test_chat_specialists.py -v`
Expected: `4 passed` — all four tests green (no live network calls are made; `TestModel`/`FunctionModel` stub the LLM).

If `test_stream_chat_emits_tagged_agent_events_for_parallel_delegation` fails with an attribute error about `_function_toolset`, check the installed PydanticAI version's internal attribute name with `uv run python -c "from pydantic_ai import Agent; from pydantic_ai.models.test import TestModel; a=Agent(TestModel()); print([x for x in dir(a) if 'tool' in x.lower()])"` and adjust the introspection accordingly — the public surface may differ across versions.

- [ ] **Step 5: Commit**

```bash
git add backend/tests/__init__.py backend/tests/test_chat_specialists.py pyproject.toml uv.lock
git commit -m "test: cover specialist registry resolution and tagged agent-event streaming"
```

---

## Task 7: Frontend — accumulate `subAgents` from `agent_event` SSE frames

**Files:**

- Modify: `frontend/src/hooks/useAISessions.js:124` (assistant message shape) and the `onEvent` handler (lines 162-204)

- [ ] **Step 1: Seed `subAgents` on the new assistant message**

In `sendMessage`, change line 124 from:

```js
const assistantMsg = {
  role: "assistant",
  content: "",
  id: genId(),
  toolNames: [],
};
```

to:

```js
const assistantMsg = {
  role: "assistant",
  content: "",
  id: genId(),
  toolNames: [],
  subAgents: [],
};
```

- [ ] **Step 2: Handle `agent_event` frames in the `onEvent` callback**

In the `onEvent` callback passed to `streamChat` (around line 162), add an `else if (event.type === "agent_event")` branch alongside the existing `text`/`tool`/`error` branches (insert it after the `tool` branch, i.e. after the closing `})` of the block ending at line 189, before `} else if (event.type === "error")`):

```js
          } else if (event.type === "agent_event") {
            _set(prev => {
              const sessions = prev.sessions.map(s => {
                if (s.id !== sessionId) return s
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.role === "assistant") {
                  const subAgents = [...(last.subAgents || [])]
                  let idx = subAgents.findIndex(a => a.name === event.agent)
                  if (idx === -1) {
                    subAgents.push({ name: event.agent, label: event.agent, status: "running", toolNames: [], summary: "" })
                    idx = subAgents.length - 1
                  }
                  const agentEntry = { ...subAgents[idx] }
                  if (event.kind === "start") {
                    agentEntry.status = "running"
                  } else if (event.kind === "tool") {
                    agentEntry.toolNames = [...agentEntry.toolNames, event.name]
                  } else if (event.kind === "done") {
                    agentEntry.status = "done"
                    agentEntry.summary = event.summary || ""
                  }
                  // "text" deltas are intentionally not accumulated into the trace —
                  // the trace shows tools called + a final summary, not a transcript.
                  subAgents[idx] = agentEntry
                  msgs[msgs.length - 1] = { ...last, subAgents }
                }
                return { ...s, messages: msgs }
              })
              return { ...prev, sessions }
            })
```

- [ ] **Step 3: Manually verify in the browser**

Run `./start.sh`, open the AI chat, ask a cross-domain question (e.g. "compare SPX gamma regime to QQQ volatility skew"), and in the browser devtools confirm `agent_event` frames arrive and `subAgents` accumulates on the in-flight assistant message — e.g. add a temporary `console.log(event)` inside the new branch, observe `start` → `tool` (zero or more) → `done` per agent, then remove the `console.log` before committing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useAISessions.js
git commit -m "feat: accumulate sub-agent trace from agent_event SSE frames"
```

---

## Task 8: Frontend — render the collapsible "Agent trace" section

**Files:**

- Modify: `frontend/src/components/ai/ChatMessage.jsx`

- [ ] **Step 1: Add imports and a small `AgentTrace` subcomponent**

Change the import line (line 2) from:

```js
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";
```

to:

```js
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
```

Then, directly above `export function ChatMessage(...)` (currently line 72), add:

```js
function AgentTrace({ subAgents }) {
  const [open, setOpen] = useState(false);
  if (!subAgents || subAgents.length === 0) return null;

  return (
    <div className="mt-1.5 border border-[var(--border)] rounded-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-3)] hover:text-[var(--text-2)] transition-colors"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        <span>Agent trace</span>
        <span className="text-[var(--text-3)]/70 normal-case tracking-normal">
          ({subAgents.filter((a) => a.status === "done").length}/
          {subAgents.length} done)
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
          {subAgents.map((agent) => (
            <div key={agent.name} className="px-2 py-1.5 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                {agent.status === "running" ? (
                  <Loader2
                    size={11}
                    className="animate-spin text-[var(--blue)]"
                  />
                ) : (
                  <span className="w-[11px] h-[11px] rounded-full bg-green-500/60 inline-block" />
                )}
                <span className="text-[var(--text-1)] font-semibold">
                  {agent.label || agent.name}
                </span>
                <span className="text-[var(--text-3)] uppercase tracking-wider text-[9px]">
                  {agent.status === "running" ? "running" : "done"}
                </span>
              </div>
              {agent.toolNames.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {agent.toolNames.map((name, i) => (
                    <span
                      key={`${name}-${i}`}
                      className="px-1.5 py-0.5 rounded-sm bg-[var(--surface-3)] text-[var(--text-2)] text-[9px]"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {agent.summary && (
                <p className="mt-1 text-[var(--text-2)] leading-snug">
                  {agent.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render `<AgentTrace />` inside the assistant bubble**

In the `ChatMessage` component, the assistant content renders inside the `<div className="max-w-[88%]">...</div>` block (lines 91-119). Insert the trace just below the message bubble's closing `</div>` (i.e. right after line 118 `</div>`, the one closing the `rounded-sm px-3 py-2.5...` bubble div, and before the wrapping `</div>` on line 119):

```jsx
        </div>
        {!isUser && <AgentTrace subAgents={message.subAgents} />}
      </div>
```

(This replaces the original two closing lines 118-119 — the inner bubble's `</div>` followed immediately by the wrapper's `</div>` — with the bubble's `</div>`, the new `<AgentTrace />` line, then the wrapper's `</div>`.)

- [ ] **Step 3: Manually verify rendering for 0, 1, and multiple specialists**

Run `./start.sh`, open the AI chat:

- Ask a single-domain question (e.g. "what's SPX gamma flip?") — confirm the trace shows one agent entry, collapsed by default, expandable to show its tool(s) and summary.
- Ask a cross-domain question (e.g. "compare SPX gamma regime to QQQ volatility skew and suggest a trade") — confirm two (or more) agent entries appear, each transitioning from a spinning "running" indicator to a green "done" dot with a summary line.
- Confirm older messages (sent before this change, with no `subAgents`) render with no trace section and no console errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ai/ChatMessage.jsx
git commit -m "feat: render collapsible agent trace in assistant chat messages"
```

---

## Task 9: End-to-end smoke test

**Files:** none (manual verification only)

- [ ] **Step 1: Run the full stack and exercise the new flow**

```bash
./start.sh
```

In the browser:

1. Open the AI chat panel and send a single-domain question — verify the answer streams in as before, the trace shows exactly one specialist, and the existing per-message actions (copy / thumbs / regenerate) still work.
2. Send a cross-domain question that should trigger parallel delegation (e.g. "compare SPX gamma regime to QQQ volatility skew and suggest a trade") — verify in the Network tab that `agent_event` frames for two specialists are interleaved (not strictly sequential) and the final synthesized answer references both domains.
3. Trigger an error path — temporarily set an invalid `FLASH_ALPHA_API_KEY` in `backend/.env`, restart the backend, ask a data question, and confirm the chat surfaces a graceful error rather than a hang or stack trace, then restore the valid key.

- [ ] **Step 2: Confirm no regressions in existing chat behavior**

Re-read `frontend/src/hooks/useAISessions.js` and `backend/routers/chat.py` to confirm nothing else depended on the removed `_build_agent`/`_get_agent`/`_agents` (none should — they were only referenced from the old `stream_chat`, which Task 5 replaced):

```bash
grep -rn "_build_agent\|_get_agent\b\|_agents\[" backend/
```

Expected: no matches (only the new `_build_specialist_agent`/`_build_orchestrator_agent`/`_get_specialist_agent`/`_get_orchestrator`/`_orchestrators`/`_specialist_agents` symbols should remain).

- [ ] **Step 3: Final review commit (only if any cleanup was needed in Step 2)**

If Step 2 found stale references, fix them and commit:

```bash
git add -A
git commit -m "chore: remove residual references to single-agent chat builder"
```

If nothing needed fixing, skip this commit — the plan is complete.

---

## Self-Review Notes

- **Spec coverage:** `SPECIALIST_REGISTRY` (Task 1), registry-driven specialist builder (Task 2), delegation-as-tools + streaming forwarding (Task 3), parallel execution (falls out of Task 4's tool registration + PydanticAI's `CallToolsNode`, exercised by Task 6's test), unified queue-based streaming (Task 5), new `agent_event` SSE shape (Tasks 5/6), frontend `subAgents` accumulation (Task 7), collapsible "Agent trace" UI (Task 8), error handling for failed specialists/orchestrator (Task 3's `try/except` returning `{"error": ...}`, Task 5's top-level `error`/`done` frames — both pre-existing top-level behavior preserved), and all three Testing-section items (Task 6 backend; Task 7/8 manual frontend verification, since no frontend test runner exists in this repo — see below).
- **Frontend test framework gap:** the spec's Testing section calls for frontend unit tests of `useAISessions.js`/`ChatMessage.jsx`, but this repo has no Vitest/Jest/RTL setup (`frontend/package.json` has no test runner). Introducing one is a separate, larger decision than this feature warrants (YAGNI) — Tasks 7 and 8 instead specify concrete manual browser verification steps covering the same 0/1/multiple-specialist cases the spec calls out.
- **Out of scope honored:** no dynamic agent spawning, no sequential/adaptive chaining (delegation is fan-out-then-synthesize per Task 4's orchestrator prompt), no new persistence beyond the existing `localStorage`-backed session shape (Task 7 only adds an in-memory `subAgents` array to the existing message object, which already round-trips through `persistSessions`).
