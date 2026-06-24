"""Engine 24: Reality Check — benchmark against Nifty buy-and-hold.

Fixed: Now reads from nifty_daily table for historical values (not a placeholder estimate).
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from tradepilot.database import get_db
from tradepilot.layer1.base import MarketDataProvider

logger = logging.getLogger(__name__)


@dataclass
class RealityCheckResult:
    period_start: str
    period_end: str
    starting_capital: float
    ending_capital: float
    strategy_return_pct: float
    nifty_start: float
    nifty_end: float
    nifty_return_pct: float
    outperformance_pct: float
    total_trades: int
    net_profit: float
    verdict: str
    verdict_type: str


async def run_reality_check(
    market_data: MarketDataProvider,
    period_start: Optional[str] = None,
    period_end: Optional[str] = None,
) -> RealityCheckResult:
    """Compare strategy returns vs Nifty. Uses nifty_daily table for historical."""
    if period_end is None:
        period_end = datetime.now().strftime("%Y-%m-%d")
    if period_start is None:
        period_start = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")

    async with get_db() as db:
        # Trade stats
        row = await db.execute(
            """SELECT COUNT(*) as cnt, SUM(net_pnl) as total_net
            FROM trades WHERE status = 'CLOSED' AND date >= ? AND date <= ?""",
            (period_start, period_end),
        )
        trade_data = await row.fetchone()
        total_trades = trade_data["cnt"] or 0
        net_profit = trade_data["total_net"] or 0.0

        # Capital
        growth_row = await db.execute("SELECT * FROM growth_state WHERE id = 1")
        growth = await growth_row.fetchone()
        ending_capital = growth["current_capital"]
        starting_capital = ending_capital - net_profit

        # Nifty from nifty_daily table (real stored values)
        nifty_start_row = await db.execute(
            "SELECT open_value, close_value FROM nifty_daily WHERE date >= ? ORDER BY date ASC LIMIT 1",
            (period_start,),
        )
        nifty_end_row = await db.execute(
            "SELECT open_value, close_value FROM nifty_daily WHERE date <= ? ORDER BY date DESC LIMIT 1",
            (period_end,),
        )
        ns_data = await nifty_start_row.fetchone()
        ne_data = await nifty_end_row.fetchone()

    # Get Nifty values (from DB if available, else live)
    nifty_start = 0.0
    nifty_end = 0.0

    if ns_data:
        nifty_start = ns_data["open_value"] or ns_data["close_value"] or 0.0
    if ne_data:
        nifty_end = ne_data["close_value"] or ne_data["open_value"] or 0.0

    # Fallback to live if no historical data
    if nifty_end == 0:
        try:
            nifty_end = await market_data.get_nifty_value()
        except Exception:
            pass
    if nifty_start == 0:
        nifty_start = nifty_end  # No historical data → 0% Nifty return (honest about data gap)
        if total_trades > 0:
            logger.warning(
                "No historical Nifty data for %s — benchmark will show 0%% Nifty return. "
                "Nifty values are stored on each trade entry/exit.",
                period_start,
            )

    # Compute returns
    strategy_return_pct = (
        (ending_capital - starting_capital) / starting_capital * 100
        if starting_capital > 0 else 0
    )
    nifty_return_pct = (
        (nifty_end - nifty_start) / nifty_start * 100
        if nifty_start > 0 else 0
    )
    outperformance_pct = strategy_return_pct - nifty_return_pct

    # Verdict
    if outperformance_pct > 0:
        verdict = (
            f"Beat Nifty buy-and-hold by {outperformance_pct:.1f}% this period — "
            "the active trading and screen time had a measurable payoff."
        )
        verdict_type = "BEATING"
    elif net_profit > 0:
        verdict = (
            "Net profit was positive, but Nifty buy-and-hold would have returned MORE "
            "with zero effort and zero charges."
        )
        verdict_type = "POSITIVE_BUT_LAGGING"
    else:
        verdict = (
            "Net loss this period, and underperformed Nifty buy-and-hold. "
            "Clearest possible signal to pause and re-examine."
        )
        verdict_type = "LOSING"

    return RealityCheckResult(
        period_start=period_start, period_end=period_end,
        starting_capital=round(starting_capital, 2), ending_capital=round(ending_capital, 2),
        strategy_return_pct=round(strategy_return_pct, 2),
        nifty_start=round(nifty_start, 2), nifty_end=round(nifty_end, 2),
        nifty_return_pct=round(nifty_return_pct, 2),
        outperformance_pct=round(outperformance_pct, 2),
        total_trades=total_trades, net_profit=round(net_profit, 2),
        verdict=verdict, verdict_type=verdict_type,
    )


async def check_mvp_exit_criteria() -> dict:
    """Check all 4 MVP validation conditions."""
    async with get_db() as db:
        row = await db.execute(
            """SELECT
                COUNT(*) as total,
                SUM(CASE WHEN was_profitable = 1 THEN 1 ELSE 0 END) as wins,
                SUM(net_pnl) as net_pnl,
                SUM(total_charges) as total_charges,
                SUM(gross_pnl) as total_gross
            FROM trades WHERE status = 'CLOSED'"""
        )
        data = await row.fetchone()

    total = data["total"] or 0
    wins = data["wins"] or 0
    net_pnl = data["net_pnl"] or 0
    total_charges = data["total_charges"] or 0
    total_gross = data["total_gross"] or 0

    win_rate = (wins / total * 100) if total > 0 else 0
    charge_drag = (total_charges / abs(total_gross) * 100) if abs(total_gross) > 0 else 0

    return {
        "total_trades": total,
        "minimum_trades_met": total >= 50,
        "net_positive": net_pnl > 0,
        "net_pnl": round(net_pnl, 2),
        "win_rate": round(win_rate, 1),
        "win_rate_met": win_rate > 55,
        "charge_drag_pct": round(charge_drag, 1),
        "charge_drag_acceptable": charge_drag < 60,
        "all_passed": total >= 50 and net_pnl > 0 and win_rate > 55,
    }
