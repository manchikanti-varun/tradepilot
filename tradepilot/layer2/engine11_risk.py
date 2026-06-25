"""Engine 11: Risk Manager — tier + growth-stage aware hard stops.

Uses async context manager for all DB access (no leaks).
"""

import logging
from dataclasses import dataclass
from datetime import datetime, date

from tradepilot.config import (
    RiskGate, CapitalTier, TIER_CONFIGS,
    MAX_TRADES_PER_DAY, MAX_CONSECUTIVE_LOSSES,
    VIX_HIGH_THRESHOLD, VIX_CAUTION_THRESHOLD,
    NIFTY_DOWN_THRESHOLD_PCT, HARD_DAILY_LOSS_CAP_PCT,
)
from tradepilot.database import get_db

logger = logging.getLogger(__name__)


@dataclass
class RiskState:
    gate: RiskGate
    reason: str | None
    trades_remaining: int
    daily_pnl: float
    consecutive_losses: int
    size_multiplier: float
    caution_notes: list[str]


async def evaluate_risk(
    current_capital: float,
    tier: CapitalTier,
    is_proven: bool,
    progress_pct_to_next_tier: float,
    vix: float = 14.0,
    nifty_change_pct: float = 0.0,
) -> RiskState:
    """Evaluate current risk state."""
    tier_config = TIER_CONFIGS[tier]
    max_risk_pct = tier_config.max_risk_pct_proven if is_proven else tier_config.max_risk_pct_unproven

    loss_mult = 2.0 if progress_pct_to_next_tier >= 85 else 2.5
    daily_loss_limit = current_capital * max_risk_pct / 100 * loss_mult
    # FIX 4.2: Hard cap at 3% of capital regardless of tier formula
    daily_loss_limit = min(daily_loss_limit, current_capital * HARD_DAILY_LOSS_CAP_PCT / 100)

    today = date.today().isoformat()

    async with get_db() as db:
        row = await db.execute(
            "SELECT trade_count, daily_pnl, consecutive_losses, hard_stop_active, hard_stop_reason "
            "FROM daily_state WHERE date = ?", (today,)
        )
        state = await row.fetchone()
        if state is None:
            await db.execute("INSERT INTO daily_state (date) VALUES (?)", (today,))
            await db.commit()
            trade_count = 0
            daily_pnl = 0.0
            consecutive_losses = 0
            hard_stop_active = False
            hard_stop_reason = None
        else:
            trade_count = state["trade_count"]
            daily_pnl = state["daily_pnl"]
            consecutive_losses = state["consecutive_losses"]
            hard_stop_active = bool(state["hard_stop_active"])
            hard_stop_reason = state["hard_stop_reason"]

    trades_remaining = MAX_TRADES_PER_DAY - trade_count
    size_multiplier = 1.0
    caution_notes = []

    # --- HARD STOP checks ---
    if hard_stop_active:
        return RiskState(gate=RiskGate.HARD_STOP, reason=hard_stop_reason or "Hard stop active",
                         trades_remaining=0, daily_pnl=daily_pnl,
                         consecutive_losses=consecutive_losses, size_multiplier=0.0, caution_notes=[])

    if daily_pnl < -daily_loss_limit:
        reason = f"Daily loss ₹{abs(daily_pnl):.2f} exceeds limit ₹{daily_loss_limit:.2f}"
        await _set_hard_stop(today, reason)
        return RiskState(gate=RiskGate.HARD_STOP, reason=reason, trades_remaining=0,
                         daily_pnl=daily_pnl, consecutive_losses=consecutive_losses,
                         size_multiplier=0.0, caution_notes=[])

    if consecutive_losses >= MAX_CONSECUTIVE_LOSSES:
        reason = f"{consecutive_losses} consecutive losses — cooling off"
        await _set_hard_stop(today, reason)
        return RiskState(gate=RiskGate.HARD_STOP, reason=reason, trades_remaining=0,
                         daily_pnl=daily_pnl, consecutive_losses=consecutive_losses,
                         size_multiplier=0.0, caution_notes=[])

    if trade_count >= MAX_TRADES_PER_DAY:
        reason = f"Max {MAX_TRADES_PER_DAY} trades/day reached"
        return RiskState(gate=RiskGate.HARD_STOP, reason=reason, trades_remaining=0,
                         daily_pnl=daily_pnl, consecutive_losses=consecutive_losses,
                         size_multiplier=0.0, caution_notes=[])

    if vix > VIX_HIGH_THRESHOLD:
        reason = f"VIX {vix:.1f} > {VIX_HIGH_THRESHOLD}"
        return RiskState(gate=RiskGate.HARD_STOP, reason=reason, trades_remaining=trades_remaining,
                         daily_pnl=daily_pnl, consecutive_losses=consecutive_losses,
                         size_multiplier=0.0, caution_notes=[])

    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    if now.hour >= 15 and now.minute >= 10:
        return RiskState(gate=RiskGate.HARD_STOP, reason="No entries after 15:10",
                         trades_remaining=0, daily_pnl=daily_pnl,
                         consecutive_losses=consecutive_losses, size_multiplier=0.0, caution_notes=[])

    # --- CAUTION checks ---
    if VIX_CAUTION_THRESHOLD <= vix <= VIX_HIGH_THRESHOLD:
        size_multiplier *= 0.5
        caution_notes.append(f"VIX {vix:.1f} — size halved")

    if nifty_change_pct < -NIFTY_DOWN_THRESHOLD_PCT:
        size_multiplier *= 0.6
        caution_notes.append(f"Nifty down {abs(nifty_change_pct):.1f}%")

    gate = RiskGate.CAUTION if caution_notes else RiskGate.GO
    return RiskState(gate=gate, reason=caution_notes[0] if caution_notes else None,
                     trades_remaining=trades_remaining, daily_pnl=daily_pnl,
                     consecutive_losses=consecutive_losses, size_multiplier=size_multiplier,
                     caution_notes=caution_notes)


async def _set_hard_stop(today: str, reason: str):
    async with get_db() as db:
        await db.execute(
            "UPDATE daily_state SET hard_stop_active = 1, hard_stop_reason = ? WHERE date = ?",
            (reason, today),
        )
        await db.commit()
    logger.warning("HARD STOP set: %s", reason)


async def record_trade_result(net_pnl: float):
    """Update daily state after a trade closes."""
    today = date.today().isoformat()
    async with get_db() as db:
        row = await db.execute("SELECT * FROM daily_state WHERE date = ?", (today,))
        if await row.fetchone() is None:
            await db.execute("INSERT INTO daily_state (date) VALUES (?)", (today,))

        if net_pnl < 0:
            await db.execute(
                "UPDATE daily_state SET trade_count = trade_count + 1, "
                "daily_pnl = daily_pnl + ?, consecutive_losses = consecutive_losses + 1 WHERE date = ?",
                (net_pnl, today),
            )
        else:
            await db.execute(
                "UPDATE daily_state SET trade_count = trade_count + 1, "
                "daily_pnl = daily_pnl + ?, consecutive_losses = 0 WHERE date = ?",
                (net_pnl, today),
            )
        await db.commit()
