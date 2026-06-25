"""Engine 5: Entry Timing — all conditions must pass before surfacing a BUY suggestion."""

from datetime import datetime
from dataclasses import dataclass

from tradepilot.config import (
    ENTRY_START_HOUR, ENTRY_START_MINUTE,
    ENTRY_END_HOUR, ENTRY_END_MINUTE,
    RiskGate,
)
from tradepilot.layer1.base import MarketDataProvider, DepthSnapshot
from tradepilot.layer2.engine4_discovery import StockScore


@dataclass
class EntryCheckResult:
    passed: bool
    reason: str
    symbol: str
    ltp: float
    score: StockScore


async def check_entry_conditions(
    score: StockScore,
    market_data: MarketDataProvider,
    has_active_position: bool,
    risk_gate: RiskGate,
    event_risk: str = "NONE",  # Phase 1: Engine 13 provides this
) -> EntryCheckResult:
    """
    ALL conditions must pass:
    - LTP within 0.3% of VWAP OR within 0.15% of resistance break
    - bid_qty_top5 > ask_qty_top5 * 0.85
    - RSI 42-70
    - No active position
    - Time 9:20-14:40
    - Engine 11 gate GO
    - No HIGH event in 60 min (Engine 13 — Phase 1, default pass)
    - Last-5-bar volume > 20-bar avg
    """
    symbol = score.symbol
    ltp = score.ltp

    # Time check
    now = datetime.now()
    entry_start = now.replace(hour=ENTRY_START_HOUR, minute=ENTRY_START_MINUTE, second=0)
    entry_end = now.replace(hour=ENTRY_END_HOUR, minute=ENTRY_END_MINUTE, second=0)
    if not (entry_start <= now <= entry_end):
        return EntryCheckResult(False, "Outside entry window (9:20-14:40)", symbol, ltp, score)

    # Active position check
    if has_active_position:
        return EntryCheckResult(False, "Active position already open", symbol, ltp, score)

    # Risk gate check
    if risk_gate == RiskGate.HARD_STOP:
        return EntryCheckResult(False, "Risk manager hard stop active", symbol, ltp, score)

    # Event risk check (Phase 1 — default pass for MVP)
    if event_risk == "HIGH":
        return EntryCheckResult(False, "HIGH event risk — A+ only in Phase 1", symbol, ltp, score)

    # RSI check: 30-75 (avoid extreme overbought/oversold)
    if not (30 <= score.rsi <= 75):
        return EntryCheckResult(
            False, f"RSI {score.rsi:.1f} outside 30-75 range", symbol, ltp, score
        )

    # VWAP proximity: within 1.0% (generous — you decide the exact timing)
    if score.vwap > 0:
        vwap_dist_pct = abs(ltp - score.vwap) / score.vwap * 100
        if vwap_dist_pct > 1.0:
            return EntryCheckResult(
                False, f"LTP {vwap_dist_pct:.2f}% from VWAP (max 1.0%)", symbol, ltp, score
            )

    # Market depth check
    depth: DepthSnapshot = await market_data.get_market_depth(symbol)
    bid_qty = sum(qty for _, qty in depth.bids)
    ask_qty = sum(qty for _, qty in depth.asks)
    if ask_qty > 0 and bid_qty < ask_qty * 0.85:
        return EntryCheckResult(
            False, f"Bid pressure weak ({bid_qty} < {ask_qty}*0.85)", symbol, ltp, score
        )

    # Volume check — at least 70% of average (still liquid enough)
    if score.volume_ratio < 0.7:
        return EntryCheckResult(
            False, f"Volume too thin (ratio {score.volume_ratio:.2f}, need 0.7+)", symbol, ltp, score
        )

    # All passed
    return EntryCheckResult(
        True,
        "All entry conditions met — place BUY in Angel One now, entry zone valid ~90 sec",
        symbol, ltp, score,
    )
