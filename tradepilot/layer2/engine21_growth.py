"""Engine 21: Capital Growth Engine — uses context manager for DB access."""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from tradepilot.config import CapitalTier, TIER_CONFIGS
from tradepilot.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class GrowthState:
    current_capital: float
    current_tier: CapitalTier
    next_tier_threshold: float
    progress_pct_to_next_tier: float
    days_to_next_tier_at_current_rate: int
    peak_capital: float
    drawdown_from_peak_pct: float
    capital_last_confirmed: Optional[str]
    is_proven: bool


def lookup_tier(capital: float) -> CapitalTier:
    if capital >= 10000:
        return CapitalTier.D
    elif capital >= 5000:
        return CapitalTier.C
    elif capital >= 2000:
        return CapitalTier.B
    return CapitalTier.A


def get_next_tier_threshold(tier: CapitalTier) -> float:
    return {CapitalTier.A: 2000.0, CapitalTier.B: 5000.0,
            CapitalTier.C: 10000.0, CapitalTier.D: 10000000.0}[tier]


async def get_growth_state() -> GrowthState:
    async with get_db() as db:
        row = await db.execute("SELECT * FROM growth_state WHERE id = 1")
        data = await row.fetchone()

        capital = data["current_capital"]
        tier = lookup_tier(capital)
        peak = data["peak_capital"]
        next_threshold = get_next_tier_threshold(tier)

        tier_config = TIER_CONFIGS[tier]
        tier_start = tier_config.range_min
        progress = ((capital - tier_start) / (next_threshold - tier_start) * 100) if next_threshold > tier_start else 100
        progress = max(0, min(100, progress))

        drawdown = ((peak - capital) / peak * 100) if peak > 0 else 0

        trades_row = await db.execute(
            "SELECT COUNT(*) as cnt, SUM(net_pnl) as total_pnl FROM trades "
            "WHERE status = 'CLOSED' AND date >= date('now', '-7 days')"
        )
        trades_data = await trades_row.fetchone()
        if trades_data and trades_data["cnt"] and trades_data["cnt"] > 0:
            daily_rate = (trades_data["total_pnl"] or 0) / 7
            remaining = next_threshold - capital
            days_to_next = int(remaining / daily_rate) if daily_rate > 0 else 999
        else:
            days_to_next = 999

        proven_col = f"is_proven_tier_{tier.value.lower()}"
        # All features unlocked — no 50-trade validation gate
        is_proven = True

        return GrowthState(
            current_capital=capital, current_tier=tier,
            next_tier_threshold=next_threshold,
            progress_pct_to_next_tier=round(progress, 1),
            days_to_next_tier_at_current_rate=days_to_next,
            peak_capital=peak, drawdown_from_peak_pct=round(drawdown, 1),
            capital_last_confirmed=data["capital_last_confirmed"],
            is_proven=is_proven,
        )


async def update_capital(new_capital: float):
    async with get_db() as db:
        row = await db.execute("SELECT peak_capital FROM growth_state WHERE id = 1")
        data = await row.fetchone()
        new_peak = max(data["peak_capital"], new_capital)
        new_tier = lookup_tier(new_capital).value

        await db.execute(
            """UPDATE growth_state SET current_capital = ?, current_tier = ?,
                peak_capital = ?, capital_last_confirmed = ? WHERE id = 1""",
            (new_capital, new_tier, new_peak, datetime.now().isoformat()),
        )
        await db.commit()
    logger.info("Capital updated: ₹%.2f (tier %s)", new_capital, new_tier)


async def set_proven(tier: CapitalTier):
    col = f"is_proven_tier_{tier.value.lower()}"
    async with get_db() as db:
        await db.execute(f"UPDATE growth_state SET {col} = 1 WHERE id = 1")
        await db.commit()
    logger.info("Tier %s marked as PROVEN", tier.value)
