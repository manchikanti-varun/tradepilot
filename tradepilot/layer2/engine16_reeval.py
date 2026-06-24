"""Engine 16: Post-Entry Re-Evaluation — "would I enter this trade NOW?"

Every 3 min while position open, re-scores with score_stock() (Engine 4's exact function).
"""

from dataclasses import dataclass
from typing import Optional

from tradepilot.config import Grade
from tradepilot.layer1.base import MarketDataProvider
from tradepilot.layer2.engine4_discovery import score_stock, StockScore, compute_grade


@dataclass
class ReEvalResult:
    action: str  # "HOLD", "WATCH", "EXIT"
    re_entry_score: float
    re_entry_grade: Grade
    reason: str
    tighten_stop: bool
    override_exit: bool
    override_reason: Optional[str] = None


async def re_evaluate_position(
    ticker: str,
    sector: str,
    market_data: MarketDataProvider,
    news_sentiment_at_entry: float = 55.0,
    sector_was_top_at_entry: bool = False,
    top_sectors: Optional[list[str]] = None,
    avoid_sectors: Optional[list[str]] = None,
) -> ReEvalResult:
    """
    Re-score the position's stock with current data.
    Uses Engine 4's exact score_stock() function — no separate implementation.
    """
    if avoid_sectors is None:
        avoid_sectors = []

    # Score with fresh data
    fresh_score = await score_stock(
        symbol=ticker,
        sector=sector,
        market_data=market_data,
        top_sectors=top_sectors,
        avoid_sectors=avoid_sectors,
    )

    if fresh_score is None:
        # Data unavailable — default to WATCH (don't exit on data failure)
        return ReEvalResult(
            action="WATCH",
            re_entry_score=0,
            re_entry_grade=Grade.C,
            reason="Data temporarily unavailable — watching",
            tighten_stop=False,
            override_exit=False,
        )

    score = fresh_score.composite
    grade = fresh_score.grade

    # --- Special case overrides (always win) ---

    # News sentiment crashed
    current_news = fresh_score.news_score
    if news_sentiment_at_entry >= 50 and current_news < 30:
        return ReEvalResult(
            action="EXIT",
            re_entry_score=score,
            re_entry_grade=grade,
            reason="News sentiment collapsed (was {:.0f}, now {:.0f}) — immediate EXIT".format(
                news_sentiment_at_entry, current_news
            ),
            tighten_stop=False,
            override_exit=True,
            override_reason="news_sentiment_collapse",
        )

    # Sector flipped from top to avoid
    if sector_was_top_at_entry and sector in avoid_sectors:
        return ReEvalResult(
            action="EXIT",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Sector {sector} moved from top to avoid list — immediate EXIT",
            tighten_stop=False,
            override_exit=True,
            override_reason="sector_flip",
        )

    # --- Normal re-eval tree ---
    if score >= 70 and grade in (Grade.A_PLUS, Grade.A):
        return ReEvalResult(
            action="HOLD",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Score {score:.0f} ({grade.value}) — would still enter, HOLD",
            tighten_stop=False,
            override_exit=False,
        )
    elif 55 <= score < 70:
        return ReEvalResult(
            action="WATCH",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Score dropped to {score:.0f} ({grade.value}) — WATCH, stop tightened 10%",
            tighten_stop=True,
            override_exit=False,
        )
    else:
        return ReEvalResult(
            action="EXIT",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Score {score:.0f} ({grade.value}) — would NOT enter now, EXIT recommendation",
            tighten_stop=False,
            override_exit=True,
            override_reason="score_degraded",
        )
