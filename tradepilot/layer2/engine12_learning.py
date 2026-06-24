"""Engine 12: Learning Engine — uses context manager for DB access."""

import logging
from dataclasses import dataclass
from datetime import date, timedelta

from tradepilot.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class TradeStats:
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_gross_pnl: float
    total_charges: float
    total_net_pnl: float
    charge_drag_pct: float
    avg_hold_duration_min: float
    avg_net_per_trade: float
    best_trade_net: float
    worst_trade_net: float


async def get_trade_stats(days: int = 30) -> TradeStats:
    since = (date.today() - timedelta(days=days)).isoformat()
    async with get_db() as db:
        row = await db.execute(
            """SELECT
                COUNT(*) as total,
                SUM(CASE WHEN was_profitable = 1 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN was_profitable = 0 THEN 1 ELSE 0 END) as losses,
                SUM(gross_pnl) as total_gross,
                SUM(total_charges) as total_charges,
                SUM(net_pnl) as total_net,
                AVG(hold_duration_min) as avg_hold,
                MAX(net_pnl) as best,
                MIN(net_pnl) as worst
            FROM trades WHERE status = 'CLOSED' AND date >= ?""",
            (since,),
        )
        data = await row.fetchone()

    total = data["total"] or 0
    wins = data["wins"] or 0
    losses = data["losses"] or 0
    total_gross = data["total_gross"] or 0
    total_charges = data["total_charges"] or 0
    total_net = data["total_net"] or 0

    return TradeStats(
        total_trades=total, winning_trades=wins, losing_trades=losses,
        win_rate=(wins / total * 100) if total > 0 else 0,
        total_gross_pnl=round(total_gross, 2),
        total_charges=round(total_charges, 2),
        total_net_pnl=round(total_net, 2),
        charge_drag_pct=round((total_charges / abs(total_gross) * 100) if abs(total_gross) > 0 else 0, 1),
        avg_hold_duration_min=round(data["avg_hold"] or 0, 1),
        avg_net_per_trade=round((total_net / total) if total > 0 else 0, 2),
        best_trade_net=round(data["best"] or 0, 2),
        worst_trade_net=round(data["worst"] or 0, 2),
    )


async def write_daily_summary():
    """Write end-of-day summary."""
    today = date.today().isoformat()
    async with get_db() as db:
        row = await db.execute(
            """SELECT
                COUNT(*) as total,
                SUM(CASE WHEN was_profitable = 1 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN was_profitable = 0 THEN 1 ELSE 0 END) as losses,
                SUM(gross_pnl) as gross, SUM(total_charges) as charges,
                SUM(net_pnl) as net
            FROM trades WHERE status = 'CLOSED' AND date = ?""",
            (today,),
        )
        data = await row.fetchone()

        growth_row = await db.execute("SELECT current_capital FROM growth_state WHERE id = 1")
        growth = await growth_row.fetchone()

        await db.execute(
            """INSERT OR REPLACE INTO daily_summary
                (date, total_trades, winning_trades, losing_trades, gross_pnl, total_charges, net_pnl, capital_end)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (today, data["total"] or 0, data["wins"] or 0, data["losses"] or 0,
             data["gross"] or 0, data["charges"] or 0, data["net"] or 0,
             growth["current_capital"] if growth else 0),
        )
        await db.commit()
    logger.info("Daily summary written for %s: %d trades, net ₹%.2f",
                today, data["total"] or 0, data["net"] or 0)
