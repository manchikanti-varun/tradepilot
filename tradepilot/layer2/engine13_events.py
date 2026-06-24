"""Engine 13: Event Calendar — hardcoded + dynamic event risk detection.

HIGH → size-60%, A+ only, exit by 12PM
MEDIUM → size-30%, A+/A, exit by 2PM
LOW → size-15%
F&O expiry → widen stops 20%, prefer non-F&O names
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from tradepilot.config import ENABLE_ENGINE13_EVENTS


@dataclass
class EventRisk:
    level: str  # "HIGH", "MEDIUM", "LOW", "NONE"
    events_today: list[dict]  # [{"time": "10:00", "event": "RBI MPC", "impact": "HIGH"}]
    size_multiplier: float  # applied on top of Engine 6
    grade_floor: str  # "A+" or "A" — minimum grade allowed
    exit_by_hour: int  # force exit by this hour (0 = no constraint)
    is_expiry_day: bool
    stop_widen_pct: float  # 0 or 20 (for F&O expiry)


# Hardcoded calendar — key recurring events (IST)
# Format: (month, day_or_week_pattern, event_name, impact)
RECURRING_EVENTS = [
    # RBI MPC (bi-monthly, ~first week of Feb/Apr/Jun/Aug/Oct/Dec)
    # Budget (Feb 1)
    # F&O expiry (last Thursday of every month)
    # US Fed FOMC (roughly every 6 weeks)
    # US CPI (second week of month)
]

# F&O expiry: last Thursday of each month
def _is_fno_expiry(d: date) -> bool:
    """Check if given date is F&O expiry (last Thursday of month)."""
    # Find last Thursday
    last_day = date(d.year, d.month + 1, 1) - timedelta(days=1) if d.month < 12 else date(d.year, 12, 31)
    # Walk backwards to find Thursday (weekday=3)
    while last_day.weekday() != 3:
        last_day -= timedelta(days=1)
    return d == last_day


# Hardcoded HIGH-impact dates for 2026 (extend as needed)
HIGH_IMPACT_DATES = {
    "2026-02-01": "Union Budget",
    "2026-04-01": "New FY Start",
    # Add RBI MPC, FOMC dates as they're announced
}

MEDIUM_IMPACT_DATES = {
    # US CPI days, RBI policy days, etc.
}


def evaluate_event_risk(target_date: Optional[date] = None) -> EventRisk:
    """
    Evaluate event risk for today (or a given date).
    Returns the sizing/grade constraints to apply.
    """
    if not ENABLE_ENGINE13_EVENTS:
        return EventRisk(
            level="NONE", events_today=[], size_multiplier=1.0,
            grade_floor="A", exit_by_hour=0, is_expiry_day=False, stop_widen_pct=0,
        )

    d = target_date or date.today()
    date_str = d.isoformat()
    events: list[dict] = []
    max_impact = "NONE"

    # Check hardcoded HIGH
    if date_str in HIGH_IMPACT_DATES:
        events.append({
            "time": "09:00",
            "event": HIGH_IMPACT_DATES[date_str],
            "impact": "HIGH",
        })
        max_impact = "HIGH"

    # Check hardcoded MEDIUM
    if date_str in MEDIUM_IMPACT_DATES:
        events.append({
            "time": "09:00",
            "event": MEDIUM_IMPACT_DATES[date_str],
            "impact": "MEDIUM",
        })
        if max_impact != "HIGH":
            max_impact = "MEDIUM"

    # Check F&O expiry
    is_expiry = _is_fno_expiry(d)
    if is_expiry:
        events.append({
            "time": "all_day",
            "event": "F&O Monthly Expiry",
            "impact": "MEDIUM",
        })
        if max_impact == "NONE":
            max_impact = "LOW"

    # Determine constraints based on max impact
    if max_impact == "HIGH":
        return EventRisk(
            level="HIGH", events_today=events,
            size_multiplier=0.4, grade_floor="A+",
            exit_by_hour=12, is_expiry_day=is_expiry,
            stop_widen_pct=20 if is_expiry else 0,
        )
    elif max_impact == "MEDIUM":
        return EventRisk(
            level="MEDIUM", events_today=events,
            size_multiplier=0.7, grade_floor="A",
            exit_by_hour=14, is_expiry_day=is_expiry,
            stop_widen_pct=20 if is_expiry else 0,
        )
    elif is_expiry:
        return EventRisk(
            level="LOW", events_today=events,
            size_multiplier=0.85, grade_floor="A",
            exit_by_hour=0, is_expiry_day=True,
            stop_widen_pct=20,
        )
    else:
        return EventRisk(
            level="NONE", events_today=events,
            size_multiplier=1.0, grade_floor="A",
            exit_by_hour=0, is_expiry_day=False,
            stop_widen_pct=0,
        )
