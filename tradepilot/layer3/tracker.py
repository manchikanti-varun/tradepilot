"""Trade Tracker — structured logbook, no broker, no auth.

Production hardening:
- Uses async context manager for all DB access (no connection leaks)
- DB-level UNIQUE index enforces single open position (not just Python-level check)
- Raises explicit error on attempt to open second position
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from tradepilot.config import CapitalTier, TradePhase
from tradepilot.database import get_db
from tradepilot.layer2.engine8_charges import calculate_angel_charges

logger = logging.getLogger(__name__)


class DuplicatePositionError(Exception):
    """Raised when attempting to open a second position."""
    pass


@dataclass
class PnLBreakdown:
    gross_pnl: float
    total_charges: float
    net_pnl: float
    net_pnl_pct: float
    charge_pct_of_gross: float
    charge_breakdown: dict


@dataclass
class Trade:
    id: Optional[int]
    ticker: str
    entry_price: float
    qty: int
    entry_time: datetime
    capital_used: float
    capital_tier: str
    leverage: float
    status: str = "OPEN"
    exit_price: Optional[float] = None
    exit_time: Optional[datetime] = None
    phase: TradePhase = TradePhase.HOLDING
    peak_price: Optional[float] = None
    stop_price: Optional[float] = None
    trail_stop: Optional[float] = None
    initial_target: Optional[float] = None
    atr_at_entry: Optional[float] = None
    composite_score: Optional[float] = None
    grade: Optional[str] = None
    sector: Optional[str] = None
    entry_vwap: Optional[float] = None
    rsi_at_entry: Optional[float] = None
    sector_was_top_at_entry: bool = False
    pnl: Optional[PnLBreakdown] = None


class TradeTracker:
    """The single source of trade truth. Manual intake only."""

    async def start_trade(
        self,
        ticker: str,
        entry_price: float,
        qty: int,
        entry_time: datetime,
        capital_used: float,
        capital_tier: str,
        leverage: float,
        stop_price: float = 0.0,
        initial_target: float = 0.0,
        atr: float = 0.0,
        composite_score: float = 0.0,
        grade: str = "",
        sector: str = "",
        entry_vwap: float = 0.0,
        rsi_at_entry: float = 0.0,
        sector_was_top: bool = False,
    ) -> Trade:
        """Record a new trade entry. Raises DuplicatePositionError if one exists."""
        async with get_db() as db:
            # Explicit check BEFORE insert (belt + suspenders with the UNIQUE index)
            row = await db.execute("SELECT id, ticker FROM trades WHERE status = 'OPEN' LIMIT 1")
            existing = await row.fetchone()
            if existing is not None:
                raise DuplicatePositionError(
                    f"Cannot open new position — {existing['ticker']} (id={existing['id']}) is still open. "
                    "Close it first via Engine 25."
                )

            try:
                cursor = await db.execute(
                    """INSERT INTO trades (
                        date, ticker, sector, entry_time, entry_price, qty,
                        capital_used, capital_tier, leverage, status, phase,
                        peak_price, stop_price, initial_target, atr_at_entry,
                        composite_score, grade, entry_vwap, rsi_at_entry,
                        sector_was_top_at_entry, entry_reported_via
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', 'HOLDING',
                             ?, ?, ?, ?, ?, ?, ?, ?, ?, 'engine25')""",
                    (
                        entry_time.strftime("%Y-%m-%d"),
                        ticker, sector,
                        entry_time.isoformat(),
                        entry_price, qty, capital_used, capital_tier, leverage,
                        entry_price,
                        stop_price, initial_target, atr,
                        composite_score, grade, entry_vwap, rsi_at_entry,
                        1 if sector_was_top else 0,
                    ),
                )
                await db.commit()
                trade_id = cursor.lastrowid
            except Exception as e:
                # UNIQUE index violation = another OPEN trade exists (race condition caught)
                if "UNIQUE constraint failed" in str(e):
                    raise DuplicatePositionError("Single-position constraint violated at DB level") from e
                raise

        logger.info("Trade opened: %s qty=%d @ %.2f (id=%d)", ticker, qty, entry_price, trade_id)

        return Trade(
            id=trade_id, ticker=ticker, entry_price=entry_price, qty=qty,
            entry_time=entry_time, capital_used=capital_used,
            capital_tier=capital_tier, leverage=leverage,
            stop_price=stop_price, initial_target=initial_target,
            peak_price=entry_price, atr_at_entry=atr,
            composite_score=composite_score, grade=grade,
            sector=sector, entry_vwap=entry_vwap,
            rsi_at_entry=rsi_at_entry, sector_was_top_at_entry=sector_was_top,
        )

    async def update_trade(self, trade_id: int, current_ltp: float) -> Optional[Trade]:
        """Update position with current LTP (called every 60s)."""
        async with get_db() as db:
            row = await db.execute("SELECT * FROM trades WHERE id = ? AND status = 'OPEN'", (trade_id,))
            data = await row.fetchone()
            if data is None:
                return None

            peak = max(data["peak_price"] or 0, current_ltp)
            await db.execute("UPDATE trades SET peak_price = ? WHERE id = ?", (peak, trade_id))
            await db.commit()
            return self._row_to_trade(data, peak_override=peak)

    async def close_trade(
        self,
        trade_id: int,
        exit_price: float,
        exit_time: datetime,
        exit_reason: str = "manual",
        actual_charges: Optional[float] = None,
    ) -> Optional[Trade]:
        """Close trade. Computes P&L via Engine 8."""
        async with get_db() as db:
            row = await db.execute("SELECT * FROM trades WHERE id = ? AND status = 'OPEN'", (trade_id,))
            data = await row.fetchone()
            if data is None:
                logger.warning("Attempted to close non-existent/already-closed trade id=%d", trade_id)
                return None

            qty = data["qty"]
            entry_price = data["entry_price"]
            capital_used = data["capital_used"]

            pnl = self.calculate_pnl(qty, entry_price, exit_price, capital_used, actual_charges)
            hold_duration = (exit_time - datetime.fromisoformat(data["entry_time"])).total_seconds() / 60

            await db.execute(
                """UPDATE trades SET
                    exit_price = ?, exit_time = ?, exit_reason = ?,
                    gross_pnl = ?, total_charges = ?, net_pnl = ?,
                    net_pnl_pct = ?, charge_pct_of_gross = ?,
                    hold_duration_min = ?, was_profitable = ?,
                    status = 'CLOSED', exit_reported_via = 'engine25'
                WHERE id = ?""",
                (
                    exit_price, exit_time.isoformat(), exit_reason,
                    pnl.gross_pnl, pnl.total_charges, pnl.net_pnl,
                    pnl.net_pnl_pct, pnl.charge_pct_of_gross,
                    hold_duration, 1 if pnl.net_pnl > 0 else 0,
                    trade_id,
                ),
            )
            await db.commit()

        logger.info(
            "Trade closed: %s @ %.2f | Net: %.2f (%.1f%%)",
            data["ticker"], exit_price, pnl.net_pnl, pnl.net_pnl_pct,
        )

        trade = self._row_to_trade(data)
        trade.exit_price = exit_price
        trade.exit_time = exit_time
        trade.status = "CLOSED"
        trade.pnl = pnl
        return trade

    def calculate_pnl(
        self, qty: int, entry_price: float, exit_price: float,
        capital_used: float, actual_charges: Optional[float] = None,
    ) -> PnLBreakdown:
        """Compute P&L using Engine 8's formula."""
        gross = qty * (exit_price - entry_price)
        charges, breakdown = calculate_angel_charges(qty, entry_price, exit_price)

        if actual_charges is not None:
            charges = actual_charges

        net = gross - charges
        net_pct = (net / capital_used * 100) if capital_used > 0 else 0
        charge_pct = (charges / abs(gross) * 100) if abs(gross) > 0 else 0

        return PnLBreakdown(
            gross_pnl=round(gross, 2),
            total_charges=round(charges, 2),
            net_pnl=round(net, 2),
            net_pnl_pct=round(net_pct, 2),
            charge_pct_of_gross=round(charge_pct, 2),
            charge_breakdown={
                "brokerage": breakdown.brokerage, "stt": breakdown.stt,
                "exchange_txn": breakdown.exchange_txn, "sebi": breakdown.sebi,
                "stamp_duty": breakdown.stamp_duty, "gst": breakdown.gst,
            },
        )

    async def get_active_trade(self) -> Optional[Trade]:
        """Get the single active trade (if any)."""
        async with get_db() as db:
            row = await db.execute("SELECT * FROM trades WHERE status = 'OPEN' LIMIT 1")
            data = await row.fetchone()
            if data is None:
                return None
            return self._row_to_trade(data)

    async def get_trade_history(self, limit: int = 60) -> list[Trade]:
        """Get closed trade history."""
        async with get_db() as db:
            rows = await db.execute(
                "SELECT * FROM trades WHERE status = 'CLOSED' ORDER BY exit_time DESC LIMIT ?",
                (limit,),
            )
            trades = []
            async for row in rows:
                trades.append(self._row_to_trade(row))
            return trades

    def _row_to_trade(self, row, peak_override: Optional[float] = None) -> Trade:
        return Trade(
            id=row["id"], ticker=row["ticker"],
            entry_price=row["entry_price"], qty=row["qty"],
            entry_time=datetime.fromisoformat(row["entry_time"]),
            capital_used=row["capital_used"], capital_tier=row["capital_tier"],
            leverage=row["leverage"], status=row["status"],
            exit_price=row["exit_price"],
            exit_time=datetime.fromisoformat(row["exit_time"]) if row["exit_time"] else None,
            phase=TradePhase(row["phase"]) if row["phase"] else TradePhase.HOLDING,
            peak_price=peak_override or row["peak_price"],
            stop_price=row["stop_price"], trail_stop=row["trail_stop"],
            initial_target=row["initial_target"], atr_at_entry=row["atr_at_entry"],
            composite_score=row["composite_score"], grade=row["grade"],
            sector=row["sector"], entry_vwap=row["entry_vwap"],
            rsi_at_entry=row["rsi_at_entry"],
            sector_was_top_at_entry=bool(row["sector_was_top_at_entry"]),
        )
