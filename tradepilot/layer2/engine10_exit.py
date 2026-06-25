"""Engine 10: Dynamic Exit — recommendation you act on manually, never auto-exit.

TRAILING stop uses trail_atr_mult[market_mode] — NOT a fixed value.
HIGH_VOL widens the trail (0.55×ATR), TRENDING tightens it (0.25×ATR),
NORMAL is 0.35×ATR. EXTENDED phase always uses 0.6×ATR.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from tradepilot.config import (
    TradePhase, FORCE_EXIT_HOUR, FORCE_EXIT_MINUTE,
    STOP_ATR_MULT, TARGET_ATR_MULT, TRAILING_TRIGGER_ATR_MULT,
    TRAIL_ATR_MULT, TRAIL_ATR_MULT_EXTENDED,
    MarketMode,
)

# FIX 6.6: All time checks use IST — Railway runs on UTC
IST = ZoneInfo("Asia/Kolkata")


@dataclass
class ExitSignal:
    should_exit: bool
    exit_type: str  # "HARD", "SOFT", "NONE"
    reason: str
    urgency: str  # "EXIT_NOW", "CONSIDER_EXIT", "HOLD"
    suggested_exit_price: float
    phase: TradePhase
    trail_stop: float
    new_stop: float


def evaluate_exit(
    entry_price: float,
    current_ltp: float,
    peak_price: float,
    stop_price: float,
    trail_stop: float,
    atr: float,
    phase: TradePhase,
    rsi: float,
    volume_ratio: float,
    macd_hist: float,
    vwap: float,
    ema9: float,
    entry_time: datetime,
    market_mode: MarketMode = MarketMode.NORMAL,
) -> ExitSignal:
    """
    Evaluate whether to exit the position.
    Returns a recommendation — user executes manually.

    Trail stop multiplier is MODE-DEPENDENT:
      NORMAL  → peak - ATR × 0.35
      HIGH_VOL → peak - ATR × 0.55 (wider, gives room in volatile markets)
      TRENDING → peak - ATR × 0.25 (tighter, rides the trend)
      EXTENDED → peak - ATR × 0.6 (always, regardless of mode)
    """
    # FIX 6.6: Use IST for force-exit time checks
    now = datetime.now(IST)
    profit = current_ltp - entry_price
    profit_atr = profit / atr if atr > 0 else 0

    # Update phase
    current_phase = phase
    if phase == TradePhase.HOLDING and profit_atr > TRAILING_TRIGGER_ATR_MULT:
        current_phase = TradePhase.TRAILING
    elif phase == TradePhase.TRAILING:
        # Check for EXTENDED: trailing + RSI < 66 + rising vol + TRENDING mode
        if rsi < 66 and volume_ratio > 1.2 and market_mode == MarketMode.TRENDING:
            current_phase = TradePhase.EXTENDED

    # Compute stops based on phase — trail multiplier depends on market_mode
    if current_phase == TradePhase.HOLDING:
        new_stop = entry_price - atr * STOP_ATR_MULT
        new_trail = trail_stop
    elif current_phase == TradePhase.TRAILING:
        # MODE-DEPENDENT trailing multiplier (spec: trail_atr_mult[mode])
        trail_mult = TRAIL_ATR_MULT[market_mode.value]
        new_trail = peak_price - atr * trail_mult
        new_stop = max(stop_price, new_trail)  # stop only tightens, never loosens
    else:  # EXTENDED
        # EXTENDED always uses 0.6 regardless of market_mode
        new_trail = peak_price - atr * TRAIL_ATR_MULT_EXTENDED
        new_stop = max(stop_price, new_trail)

    # --- HARD EXIT triggers ---
    hard_reason = None

    # Stop/trail hit
    if current_ltp <= new_stop:
        hard_reason = f"Stop hit at ₹{new_stop:.2f}"

    # Time-based force exit at 14:50 (IST)
    if now.hour == FORCE_EXIT_HOUR and now.minute >= FORCE_EXIT_MINUTE:
        hard_reason = "Market closing — force exit by 14:50"
    elif now.hour > FORCE_EXIT_HOUR:
        # Past 14:50 but before 15:10 still needs exit
        if now.hour == 15 and now.minute < 10:
            hard_reason = "Past 14:50 — exit intraday position"

    # Time past 15:10 (absolute deadline)
    if now.hour >= 15 and now.minute >= 10:
        hard_reason = "Past 15:10 — must exit intraday position"

    if hard_reason:
        return ExitSignal(
            should_exit=True,
            exit_type="HARD",
            reason=hard_reason,
            urgency="EXIT_NOW",
            suggested_exit_price=current_ltp,
            phase=current_phase,
            trail_stop=new_trail if current_phase != TradePhase.HOLDING else trail_stop,
            new_stop=new_stop,
        )

    # --- SOFT EXIT triggers (2 of 3 needed) ---
    soft_signals = 0
    soft_reasons = []

    # RSI divergence (overbought > 75)
    if rsi > 75:
        soft_signals += 1
        soft_reasons.append(f"RSI overbought ({rsi:.1f})")

    # Volume drop
    if volume_ratio < 0.7:
        soft_signals += 1
        soft_reasons.append(f"Volume dropping (ratio {volume_ratio:.2f})")

    # VWAP cross-under
    if current_ltp < vwap and entry_price >= vwap:
        soft_signals += 1
        soft_reasons.append("Crossed below VWAP")

    # MACD turn negative
    if macd_hist < 0:
        soft_signals += 1
        soft_reasons.append("MACD turned negative")

    # Below EMA9 (3 consecutive closes — simplified to current check)
    if current_ltp < ema9:
        soft_signals += 1
        soft_reasons.append("Below EMA9")

    if soft_signals >= 2:
        return ExitSignal(
            should_exit=True,
            exit_type="SOFT",
            reason=" | ".join(soft_reasons[:3]),
            urgency="CONSIDER_EXIT",
            suggested_exit_price=current_ltp,
            phase=current_phase,
            trail_stop=new_trail if current_phase != TradePhase.HOLDING else trail_stop,
            new_stop=new_stop,
        )

    # --- HOLD ---
    target = entry_price + atr * TARGET_ATR_MULT
    hold_reason = f"Holding — target ₹{target:.2f}, stop ₹{new_stop:.2f}"
    if soft_signals == 1:
        hold_reason += f" (watch: {soft_reasons[0]})"

    return ExitSignal(
        should_exit=False,
        exit_type="NONE",
        reason=hold_reason,
        urgency="HOLD",
        suggested_exit_price=target,
        phase=current_phase,
        trail_stop=new_trail if current_phase != TradePhase.HOLDING else trail_stop,
        new_stop=new_stop,
    )
