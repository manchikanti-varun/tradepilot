"""Engine 20: Self-Audit — classifies losses, suggests ONE fix per week.

Gates on ≥10 losses in the analysis window before producing output.
Never auto-applies threshold changes — requires manual Settings confirmation.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from tradepilot.config import ENABLE_ENGINE20_SELF_AUDIT
from tradepilot.database import get_db


MIN_LOSSES_FOR_AUDIT = 10

LOSS_CAUSES = [
    "LATE_ENTRY",          # entered after optimal window
    "HELD_TOO_LONG",       # ignored exit signals
    "WRONG_SECTOR",        # sector was weak at entry
    "NEWS_REVERSAL",       # unexpected negative news
    "CHARGE_DRAG",         # charges consumed all profit
    "WEAK_SETUP_OVERRIDE", # low-grade entry pushed through
    "REGIME_MISMATCH",     # traded against the market mode
]


@dataclass
class LossClassification:
    trade_id: int
    ticker: str
    net_pnl: float
    primary_cause: str
    reasoning: str


@dataclass
class SelfAuditReport:
    week_start: str
    week_end: str
    total_losses: int
    is_active: bool
    breakdown: dict[str, int]  # {cause: count}
    breakdown_pct: dict[str, float]
    top_cause: str
    top_actionable_fix: str
    all_fixes: list[str]
    note: str


async def run_self_audit(lookback_days: int = 14) -> SelfAuditReport:
    """
    Weekly loss classification. Forced-choice: each loss gets ONE primary cause.
    """
    if not ENABLE_ENGINE20_SELF_AUDIT:
        return SelfAuditReport(
            week_start="", week_end="", total_losses=0, is_active=False,
            breakdown={}, breakdown_pct={}, top_cause="",
            top_actionable_fix="Engine 20 disabled", all_fixes=[], note="Disabled",
        )

    end = date.today()
    start = end - timedelta(days=lookback_days)

    async with get_db() as db:
        rows = await db.execute(
            """SELECT id, ticker, net_pnl, exit_reason, hold_duration_min,
                composite_score, grade, sector_rank_at_entry, market_mode,
                charge_pct_of_gross
            FROM trades WHERE status = 'CLOSED' AND was_profitable = 0
            AND date >= ? AND date <= ?
            ORDER BY date DESC""",
            (start.isoformat(), end.isoformat()),
        )

        losses = []
        async for row in rows:
            losses.append(dict(row))

        total_losses = len(losses)

        if total_losses < MIN_LOSSES_FOR_AUDIT:
            return SelfAuditReport(
                week_start=start.isoformat(), week_end=end.isoformat(),
                total_losses=total_losses, is_active=False,
                breakdown={}, breakdown_pct={}, top_cause="",
                top_actionable_fix=f"Insufficient losses for audit ({total_losses}/{MIN_LOSSES_FOR_AUDIT})",
                all_fixes=[], note="Need more data",
            )

        # Classify each loss
        breakdown = {cause: 0 for cause in LOSS_CAUSES}
        for loss in losses:
            cause = _classify_loss(loss)
            breakdown[cause] += 1

        # Percentages
        breakdown_pct = {k: round(v / total_losses * 100, 1) for k, v in breakdown.items()}

        # Top cause
        top_cause = max(breakdown, key=breakdown.get)
        top_fix = _suggest_fix(top_cause)

        return SelfAuditReport(
            week_start=start.isoformat(),
            week_end=end.isoformat(),
            total_losses=total_losses,
            is_active=True,
            breakdown={k: v for k, v in breakdown.items() if v > 0},
            breakdown_pct={k: v for k, v in breakdown_pct.items() if v > 0},
            top_cause=top_cause,
            top_actionable_fix=top_fix,
            all_fixes=[_suggest_fix(c) for c in LOSS_CAUSES if breakdown[c] > 0],
            note=f"Analyzed {total_losses} losses over {lookback_days} days",
        )


def _classify_loss(trade: dict) -> str:
    """Classify a single loss into its primary cause (forced-choice)."""
    charge_pct = trade.get("charge_pct_of_gross") or 0
    hold_min = trade.get("hold_duration_min") or 0
    grade = trade.get("grade") or ""
    exit_reason = trade.get("exit_reason") or ""

    # Priority order (first match wins)
    if charge_pct > 80:
        return "CHARGE_DRAG"
    if "news" in exit_reason.lower() or "sentiment" in exit_reason.lower():
        return "NEWS_REVERSAL"
    if grade in ("B", "C", "D"):
        return "WEAK_SETUP_OVERRIDE"
    if hold_min > 120:  # held > 2 hours before losing
        return "HELD_TOO_LONG"
    if "sector" in exit_reason.lower():
        return "WRONG_SECTOR"
    if hold_min < 5:
        return "LATE_ENTRY"
    return "REGIME_MISMATCH"


def _suggest_fix(cause: str) -> str:
    """Suggest one actionable fix for a loss cause."""
    fixes = {
        "LATE_ENTRY": "Tighten entry window — only enter within first 5 min of signal generation",
        "HELD_TOO_LONG": "Enforce stricter time-based exits — consider 90-min max hold rule",
        "WRONG_SECTOR": "Increase sector weight in scoring or add sector momentum confirmation",
        "NEWS_REVERSAL": "Add post-entry news monitoring with tighter news-sentiment exit threshold",
        "CHARGE_DRAG": "Raise minimum ATR filter or reduce trade frequency at this capital level",
        "WEAK_SETUP_OVERRIDE": "Enforce grade A/A+ floor strictly — no B-grade entries regardless of conviction",
        "REGIME_MISMATCH": "Reduce size in unfavorable regime or restrict to A+ only in HIGH_VOL",
    }
    return fixes.get(cause, "Review trading journal for pattern")
