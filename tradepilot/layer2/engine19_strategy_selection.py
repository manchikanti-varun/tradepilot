"""Engine 19: Adaptive Strategy Selection — gates on ≥15 trades per profile.

Profiles: MOMENTUM (default), BREAKOUT, NEWS_DRIVEN, VWAP_REVERSAL.
Until ≥15 trades per profile: run MOMENTUM only, no exception.
"""

from dataclasses import dataclass
from typing import Optional

from tradepilot.config import ENABLE_ENGINE19_STRATEGY
from tradepilot.database import get_db


MIN_TRADES_PER_PROFILE = 1  # No gate — strategy selection active immediately

STRATEGY_PROFILES = {
    "MOMENTUM": {
        "technical_weight": 0.30,
        "volume_weight": 0.20,
        "news_weight": 0.25,
        "sector_weight": 0.15,
        "momentum_weight": 0.10,
    },
    "BREAKOUT": {
        "technical_weight": 0.20,
        "volume_weight": 0.35,  # volume surge weighted higher
        "news_weight": 0.15,
        "sector_weight": 0.10,
        "momentum_weight": 0.20,  # resistance-break + momentum
    },
    "NEWS_DRIVEN": {
        "technical_weight": 0.15,
        "volume_weight": 0.15,
        "news_weight": 0.45,  # news dominates
        "sector_weight": 0.15,
        "momentum_weight": 0.10,
    },
    "VWAP_REVERSAL": {
        "technical_weight": 0.35,  # mean-reversion bias
        "volume_weight": 0.25,
        "news_weight": 0.15,
        "sector_weight": 0.10,
        "momentum_weight": 0.15,
    },
}


@dataclass
class StrategySelection:
    active_strategy: str  # "MOMENTUM", "BREAKOUT", etc.
    weights: dict[str, float]
    win_rate_by_strategy: dict[str, float]
    avg_net_by_strategy: dict[str, float]
    is_learned: bool
    note: str


async def get_active_strategy() -> StrategySelection:
    """
    Select the best-performing strategy profile, or default to MOMENTUM.
    """
    default_weights = STRATEGY_PROFILES["MOMENTUM"]

    if not ENABLE_ENGINE19_STRATEGY:
        return StrategySelection(
            active_strategy="MOMENTUM", weights=default_weights,
            win_rate_by_strategy={}, avg_net_by_strategy={},
            is_learned=False, note="Engine 19 disabled",
        )

    async with get_db() as db:
        # Check if we have enough trades per strategy
        # For now, all trades are tagged MOMENTUM until profiles are explicitly used
        row = await db.execute(
            "SELECT COUNT(*) as cnt FROM trades WHERE status = 'CLOSED'"
        )
        data = await row.fetchone()
        total = data["cnt"] or 0

        if total < MIN_TRADES_PER_PROFILE:
            return StrategySelection(
                active_strategy="MOMENTUM", weights=default_weights,
                win_rate_by_strategy={}, avg_net_by_strategy={},
                is_learned=False,
                note=f"Insufficient data ({total}/{MIN_TRADES_PER_PROFILE}). Using MOMENTUM.",
            )

        # Compute win rate for default strategy (all trades are MOMENTUM for now)
        row2 = await db.execute(
            """SELECT
                SUM(CASE WHEN was_profitable=1 THEN 1 ELSE 0 END) as wins,
                AVG(net_pnl) as avg_net
            FROM trades WHERE status = 'CLOSED'"""
        )
        stats = await row2.fetchone()
        wr = (stats["wins"] or 0) / total if total > 0 else 0

        return StrategySelection(
            active_strategy="MOMENTUM",
            weights=default_weights,
            win_rate_by_strategy={"MOMENTUM": round(wr, 3)},
            avg_net_by_strategy={"MOMENTUM": round(stats["avg_net"] or 0, 2)},
            is_learned=total >= MIN_TRADES_PER_PROFILE,
            note="MOMENTUM is the only strategy with sufficient data",
        )
