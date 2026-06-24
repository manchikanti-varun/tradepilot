"""Engine 9: Position Management — 60-sec monitoring loop.

Tracks the active position, updates LTP, recomputes net PnL,
updates peak price, checks Engine 10 exits and Engine 16 re-eval.

The actual monitoring loop is in orchestrator.run_position_monitor().
This module provides the data structures and helpers.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from tradepilot.config import TradePhase


@dataclass
class PositionState:
    """Live state of the active position."""
    ticker: str
    qty: int
    entry_price: float
    entry_time: datetime
    stop_price: float
    initial_target: float
    current_ltp: float
    peak_price: float
    trail_stop: float
    phase: TradePhase
    charges_entry_estimate: float
    atr: float
    entry_score: float
    entry_vwap: float
    sector_was_top_at_entry: bool
    news_sentiment_at_entry: float
    capital_tier_at_entry: str
    source: str = "manual_intake"

    @property
    def unrealized_gross(self) -> float:
        return self.qty * (self.current_ltp - self.entry_price)

    @property
    def hold_duration_min(self) -> float:
        return (datetime.now() - self.entry_time).total_seconds() / 60
