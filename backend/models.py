from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Strike(BaseModel):
    strike: float
    call_gex: float
    put_gex: float
    net_gex: float
    call_oi: int = 0
    put_oi: int = 0
    call_volume: int = 0
    put_volume: int = 0
    call_oi_change: Optional[int] = None
    put_oi_change: Optional[int] = None
    is_flip: bool = False
    is_spot: bool = False


class KeyLevel(BaseModel):
    strike: float
    gex: float
    oi: int


class InstrumentGEX(BaseModel):
    symbol: str
    spot: float
    flip: float
    net_gex: float
    regime: str  # "Positive" | "Negative"
    call_wall: KeyLevel
    put_wall: KeyLevel
    max_pain: Optional[float] = None
    strikes: list[Strike]
    updated_at: str
    flow_direction: str
    net_chex: float
    net_vex:float


class GEXResponse(BaseModel):
    instruments: list[InstrumentGEX]
    as_of: str
    source: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


class GEXSnapshot(BaseModel):
    timestamp: str
    spot: float
    net_gex: float
    flip: float
    call_wall_strike: float
    put_wall_strike: float


class IntradaySeries(BaseModel):
    symbol: str
    snapshots: list[GEXSnapshot]


class DealerRisk(BaseModel):
    symbol: str
    as_of: datetime
    underlying_price: float
    live_net_gex: float
    flow_gex_pct_shift: float
    live_net_dex: float
    flow_dex_pct_shift: float
    total_abs_delta_contracts: int
    contracts_with_flow: int
    flow_direction: str  # "neutral" | "bullish" | "bearish"
    description: str


class ScoreBreakdown(BaseModel):
    premium: float = 0.0
    size_vs_oi: float = 0.0
    aggressor: float = 0.0
    sweep: float = 0.0
    opening_bias: float = 0.0
    tenor: float = 0.0


class SignalEnrichment(BaseModel):
    iv: Optional[float] = None
    delta: Optional[float] = None
    gamma: Optional[float] = None
    iv_vs_atm: Optional[float] = None
    moneyness: Optional[str] = None
    estimated_delta_notional: Optional[float] = None
    hypothetical_gex_impact_if_opening: Optional[float] = None


class ChainContext(BaseModel):
    call_wall: Optional[float] = None
    put_wall: Optional[float] = None
    max_pain: Optional[float] = None
    gamma_flip: Optional[float] = None


class FlowSignal(BaseModel):
    ts: str
    expiry: str
    strike: float
    right: str
    side: str
    price: float
    size: int
    premium: float
    dte: int
    structure: str
    aggressor: str
    open_close_bias: str
    open_close_confidence: float
    contract_net_oi_delta: float
    intent: str
    score: float
    conviction: str
    tags: list[str]
    score_breakdown: ScoreBreakdown
    enrichment: SignalEnrichment


class FlowSignalsResponse(BaseModel):
    symbol: str
    as_of: str
    underlying_price: float
    window_minutes: int
    chain: ChainContext
    count: int
    signals: list[FlowSignal]


class FlowSignalsSummary(BaseModel):
    symbol: str
    as_of: str
    window_minutes: int
    expiry: Optional[str] = None
    underlying_price: float
    signal_count: int
    bullish_premium: float
    bearish_premium: float
    net_directional_premium: float
    opening_premium: float
    closing_premium: float
    top_signals: list[FlowSignal] = []


class LeaderboardEntry(BaseModel):
    model_config = {"populate_by_name": True, "serialize_by_alias": True}
    symbol: str
    net_volume: int = Field(alias="netVolume", default=0)
    net_notional: float = Field(alias="netNotional", default=0.0)
    buy_volume: int = Field(alias="buyVolume", default=0)
    sell_volume: int = Field(alias="sellVolume", default=0)
    avg_premium: float = Field(alias="avgPremium", default=0.0)
    trade_count: int = Field(alias="tradeCount", default=0)
    last_trade_utc: str = Field(alias="lastTradeUtc", default="")


class LeaderboardResponse(BaseModel):
    model_config = {"populate_by_name": True, "serialize_by_alias": True}
    generated_utc: str = Field(alias="generatedUtc", default="")
    n: int = 0
    window_minutes: int = Field(alias="windowMinutes", default=60)
    buyers: list[LeaderboardEntry] = []
    sellers: list[LeaderboardEntry] = []
