"""Engine 22: Rejection Log — uses context manager for DB access."""

from dataclasses import dataclass
from datetime import datetime, date
from typing import Optional

from tradepilot.database import get_db


@dataclass
class RejectionEntry:
    ticker: str
    reason: str
    composite_score: float
    ltp: float
    timestamp: datetime


@dataclass
class DailyRejectionSummary:
    date: str
    total_scanned: int
    total_rejected: int
    total_passed_to_entry: int
    total_entered: int
    breakdown: list[dict]
    top_reason_plain: str


async def log_rejection(ticker: str, reason: str, composite_score: float = 0.0, ltp: float = 0.0):
    """Log a rejection."""
    now = datetime.now()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO rejection_log (date, ticker, reason, composite_score, ltp_at_rejection, timestamp) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (now.strftime("%Y-%m-%d"), ticker, reason, composite_score, ltp, now.isoformat()),
        )
        await db.commit()


async def get_daily_rejection_summary(
    target_date: Optional[str] = None,
    total_scanned: int = 0,
    total_entered: int = 0,
) -> DailyRejectionSummary:
    if target_date is None:
        target_date = date.today().isoformat()

    async with get_db() as db:
        rows = await db.execute(
            "SELECT reason, COUNT(*) as cnt FROM rejection_log WHERE date = ? GROUP BY reason ORDER BY cnt DESC",
            (target_date,),
        )
        breakdown = []
        total_rejected = 0
        async for row in rows:
            breakdown.append({"reason": row["reason"], "count": row["cnt"]})
            total_rejected += row["cnt"]

    for item in breakdown:
        item["pct"] = round(item["count"] / total_rejected * 100) if total_rejected > 0 else 0

    total_passed = total_scanned - total_rejected if total_scanned > total_rejected else 0

    reason_labels = {
        "CHARGES_TOO_HIGH": "charges too high", "VOLUME_WEAK": "weak volume",
        "SECTOR_WEAK": "weak sector", "RISK_REWARD_POOR": "poor risk:reward",
        "GRADE_TOO_LOW": "low score", "ENTRY_TIMING_FAILED": "timing failed",
        "EVENT_RISK_BLOCK": "event risk", "RISK_MANAGER_BLOCK": "risk limit hit",
    }
    top_reason = reason_labels.get(breakdown[0]["reason"], breakdown[0]["reason"]) if breakdown else "none"

    return DailyRejectionSummary(
        date=target_date, total_scanned=total_scanned,
        total_rejected=total_rejected, total_passed_to_entry=total_passed,
        total_entered=total_entered, breakdown=breakdown,
        top_reason_plain=f"{total_rejected} signals rejected today — {top_reason}" if total_rejected > 0 else "No rejections yet today",
    )
