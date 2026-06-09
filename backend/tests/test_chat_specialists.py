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

    # The installed pydantic-ai (1.104.0) requires FunctionModel to be given a
    # `stream_function` to support `.stream()` (used by stream_chat's orchestrator
    # loop) — a plain `function` alone raises an AssertionError at request time.
    # This stream_function mirrors orchestrator_fn's turn-based behaviour as a
    # streamed response (deviation from the verbatim spec, required for the
    # installed library version).
    async def orchestrator_stream_fn(messages: list[ModelMessage], info: AgentInfo):
        from pydantic_ai.models.function import DeltaToolCall

        call_count["n"] += 1
        if call_count["n"] == 1:
            yield {
                0: DeltaToolCall(name="delegate_to_exposure_agent",
                                 json_args='{"query": "SPX gamma regime"}', tool_call_id="t1"),
                1: DeltaToolCall(name="delegate_to_volatility_agent",
                                 json_args='{"query": "SPX vol skew"}', tool_call_id="t2"),
            }
        else:
            # Yield an empty first chunk so pydantic-ai treats the subsequent
            # chunk as an incremental PartDeltaEvent/TextPartDelta (a lone
            # full-string yield instead produces a single complete TextPart via
            # PartStartEvent, which stream_chat's orchestrator loop does not
            # forward as a "text" SSE frame).
            yield ""
            yield "Synthesized cross-domain answer."

    fake_orchestrator = Agent(
        FunctionModel(orchestrator_fn, stream_function=orchestrator_stream_fn),
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


import httpx as _httpx


@pytest.mark.asyncio
async def test_bars_indicator_tool_hardcodes_window_and_enriches(monkeypatch):
    """The dedicated bars tool must inject resolution=1m&minutes=60 and return
    the enriched indicator summary, not the raw bars."""
    captured = {}

    class _FakeResp:
        def raise_for_status(self): pass
        def json(self):
            return {
                "symbol": "SPY", "resolution": "1m", "minutes": 60, "count": 2,
                "bars": [
                    {"close": 100.0, "buyVolume": 10, "sellVolume": 5, "midVolume": 0,
                     "netVolume": 5, "vwap": 99.5},
                    {"close": 101.0, "buyVolume": 20, "sellVolume": 5, "midVolume": 0,
                     "netVolume": 15, "vwap": 100.0},
                ],
            }

    class _FakeClient:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, url, params=None, headers=None):
            captured["url"] = url
            captured["params"] = params
            return _FakeResp()

    monkeypatch.setattr(_httpx, "AsyncClient", _FakeClient)

    endpoint = chat._ENDPOINT_BY_NAME["get_stock_bars_with_indicators"]
    input_model = chat._build_input_model(endpoint)
    tool_fn = chat._make_bars_indicator_tool_fn(endpoint, input_model)

    ctx = type("Ctx", (), {"deps": chat.FlashAlphaDeps(api_key="k")})()
    result = await tool_fn(ctx, input_model(symbol="spy"))

    # window hardcoded, symbol upper-cased into the path
    assert captured["params"] == {"resolution": "1m", "minutes": 60}
    assert captured["url"].endswith("/v1/flow/stocks/SPY/bars")
    # enriched, not raw
    assert result["bars_count"] == 2
    assert "macd" in result and "vwap" in result
    assert "bars" not in result
