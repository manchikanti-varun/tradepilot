"""Engine 23: Opportunity Archive — hypothetical tracking of rejected signals.

⚠️ CRITICAL: Data from this engine is HYPOTHETICAL.
NEVER merged into Engine 12's trades table.
NEVER counted toward the 50-trade validation criterion.
NEVER displayed with the same visual weight as real P&L.

At EOD (3:45 PM), fetches close price for each rejection and classifies.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

from tradepilot.config import ENABLE_ENGINE23_ARCHIVE
from tradepilot.database import get_db
from tradepilot.layer1.base import MarketDataProvider


MIN_SKIPS_FOR_WEEKLY_SUMMARY = 20


@dataclass
class SkippedOpportunity:
    date: str
    ticker: str
    rejection_reason: str
    ltp_at_rejection: float
    close_price_eod: float
    hypothetical_move_pct: float
    classification: str  # plain-language assessment


@dataclass
class WeeklySummary:
    week_start: str
    week_end: str
    total_skips: int
    by_reason: dict[str, int]
    missed_opportunities: int  # moves > 2% in our favor
    correct_skips: int  # stock went nowhere or down
    suggestions: list[str]
    is_sufficient: bool


async def process_eod_archive(market_data: MarketDataProvider) -> list[SkippedOpportunity]:
    """
    At 3:45 PM: fetch close prices for today's rejections, classify outcomes.
    """
    if not ENABLE_ENGINE23_ARCHIVE:
        return []

    today = date.today().isoformat()
    results = []

    async with get_db() as db:
        rows = await db.execute(
            "SELECT * FROM rejection_log WHERE date = ?", (today,)
        )
        rejections = []
        async for row in rows:
            rejections.append(dict(row))

        for rej in rejections:
            ticker = rej["ticker"]
            ltp_at_rej = rej["ltp_at_rejection"]

            # Fetch current/close price
            try:
                close_price = await market_data.get_ltp(ticker)
            except Exception:
                continue

            if ltp_at_rej <= 0:
                continue

            move_pct = (close_price - ltp_at_rej) / ltp_at_rej * 100
            classification = _classify_outcome(rej["reason"], move_pct)

            # Store in archive
            await db.execute(
                """INSERT INTO opportunity_archive
                    (date, ticker, rejection_reason, score_at_rejection,
                     ltp_at_rejection, close_price_eod, hypothetical_move_pct,
                     classification, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    today, ticker, rej["reason"], rej["composite_score"],
                    ltp_at_rej, close_price, round(move_pct, 2),
                    classification, datetime.now().isoformat(),
                ),
            )

            results.append(SkippedOpportunity(
                date=today, ticker=ticker,
                rejection_reason=rej["reason"],
                ltp_at_rejection=ltp_at_rej,
                close_price_eod=close_price,
                hypothetical_move_pct=round(move_pct, 2),
                classification=classification,
            ))

        await db.commit()

    return results


async def get_weekly_archive_summary() -> WeeklySummary:
    """Generate weekly summary (only if ≥20 skips for a reason)."""
    if not ENABLE_ENGINE23_ARCHIVE:
        return WeeklySummary(
            week_start="", week_end="", total_skips=0,
            by_reason={}, missed_opportunities=0, correct_skips=0,
            suggestions=[], is_sufficient=False,
        )

    from datetime import timedelta
    end = date.today()
    start = end - timedelta(days=7)

    async with get_db() as db:
        rows = await db.execute(
            """SELECT rejection_reason, COUNT(*) as cnt,
                SUM(CASE WHEN hypothetical_move_pct > 2 THEN 1 ELSE 0 END) as missed,
                SUM(CASE WHEN abs(hypothetical_move_pct) < 0.3 THEN 1 ELSE 0 END) as correct_flat,
                SUM(CASE WHEN hypothetical_move_pct < -2 THEN 1 ELSE 0 END) as correct_drop
            FROM opportunity_archive
            WHERE date >= ? AND date <= ?
            GROUP BY rejection_reason""",
            (start.isoformat(), end.isoformat()),
        )

        by_reason = {}
        total_missed = 0
        total_correct = 0
        total_skips = 0
        suggestions = []

        async for row in rows:
            reason = row["rejection_reason"]
            cnt = row["cnt"]
            missed = row["missed"] or 0
            correct = (row["correct_flat"] or 0) + (row["correct_drop"] or 0)

            by_reason[reason] = cnt
            total_skips += cnt
            total_missed += missed
            total_correct += correct

            if cnt >= MIN_SKIPS_FOR_WEEKLY_SUMMARY and missed > cnt * 0.3:
                suggestions.append(
                    f"Reason '{reason}': {missed}/{cnt} skips moved >2% — "
                    "worth reviewing whether this threshold is too strict."
                )

        is_sufficient = total_skips >= MIN_SKIPS_FOR_WEEKLY_SUMMARY

        return WeeklySummary(
            week_start=start.isoformat(),
            week_end=end.isoformat(),
            total_skips=total_skips,
            by_reason=by_reason,
            missed_opportunities=total_missed,
            correct_skips=total_correct,
            suggestions=suggestions if is_sufficient else ["Insufficient data for weekly summary"],
            is_sufficient=is_sufficient,
        )


def _classify_outcome(rejection_reason: str, move_pct: float) -> str:
    """Classify in plain language — never as a P&L number."""
    if rejection_reason == "CHARGES_TOO_HIGH" and move_pct > 2:
        return "This skip likely cost an opportunity — worth reviewing whether the 1.8% break-even threshold is too strict."
    if abs(move_pct) < 0.3:
        return "This skip looks correct in hindsight — the stock went nowhere."
    if rejection_reason == "VOLUME_WEAK" and move_pct < -2:
        return "This skip looks correct — weak volume preceded a real decline."
    if move_pct > 2:
        return f"Stock moved +{move_pct:.1f}% — potential missed opportunity."
    if move_pct < -1:
        return f"Stock dropped {move_pct:.1f}% — skip was protective."
    return "Marginal outcome — skip was neither clearly right nor wrong."
