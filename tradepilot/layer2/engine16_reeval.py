"""Engine 16: Post-Entry Re-Evaluation — "would I enter this trade NOW?"

Every 3 min while position open, re-scores with score_stock() (Engine 4's exact function).
AI-enhanced: when available, AI provides hold/exit/tighten recommendation based on full context.
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
    ai_reasoning: Optional[str] = None  # AI explanation when available


async def re_evaluate_position(
    ticker: str,
    sector: str,
    market_data: MarketDataProvider,
    news_sentiment_at_entry: float = 55.0,
    sector_was_top_at_entry: bool = False,
    top_sectors: Optional[list[str]] = None,
    avoid_sectors: Optional[list[str]] = None,
    # Additional context for AI (optional)
    entry_price: float = 0,
    current_ltp: float = 0,
    pnl: float = 0,
    hold_min: float = 0,
    stop_price: float = 0,
    peak_price: float = 0,
    rsi: float = 50,
    macd: float = 0,
    volume_ratio: float = 1.0,
    above_vwap: bool = True,
    ema_bullish: bool = True,
    market_mode: str = "NORMAL",
) -> ReEvalResult:
    """
    Re-score the position's stock with current data.
    Uses Engine 4's exact score_stock() function + AI enhancement when available.
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

    # --- AI-ENHANCED RE-EVALUATION ---
    ai_reasoning = None
    ai_action = None
    if entry_price > 0 and current_ltp > 0:
        try:
            from tradepilot.layer2.engine_ai import ai_reeval_position
            from tradepilot.layer2.engine27_news import _news_cache
            from datetime import datetime
            from zoneinfo import ZoneInfo

            # Compute time remaining
            now = datetime.now(ZoneInfo("Asia/Kolkata"))
            market_close = now.replace(hour=15, minute=30)
            time_remaining = f"{max(0, int((market_close - now).total_seconds() // 60))} min"

            news_mood = _news_cache.overall_mood if _news_cache else "NEUTRAL"

            ai_result = await ai_reeval_position({
                "ticker": ticker,
                "entry_price": entry_price,
                "current_ltp": current_ltp,
                "pnl": pnl,
                "pnl_pct": (pnl / (entry_price * 1) * 100) if entry_price > 0 else 0,
                "hold_min": hold_min,
                "stop_price": stop_price,
                "peak_price": peak_price,
                "rsi": rsi,
                "macd": macd,
                "above_vwap": above_vwap,
                "volume_ratio": volume_ratio,
                "ema_bullish": ema_bullish,
                "market_mode": market_mode,
                "news_mood": news_mood,
                "time_remaining": time_remaining,
            })

            if ai_result:
                ai_action = ai_result.get("action")
                ai_reasoning = ai_result.get("reasoning")
        except Exception:
            pass  # Graceful fallback to rule-based

    # --- Normal re-eval tree (enhanced with AI input) ---
    if score >= 70 and grade in (Grade.A_PLUS, Grade.A):
        # Rule says HOLD — but AI might disagree
        if ai_action == "EXIT" and ai_reasoning:
            return ReEvalResult(
                action="WATCH",
                re_entry_score=score,
                re_entry_grade=grade,
                reason=f"Score {score:.0f} ({grade.value}) still strong, but AI suggests caution",
                tighten_stop=True,
                override_exit=False,
                ai_reasoning=ai_reasoning,
            )
        return ReEvalResult(
            action="HOLD",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Score {score:.0f} ({grade.value}) — would still enter, HOLD",
            tighten_stop=False,
            override_exit=False,
            ai_reasoning=ai_reasoning,
        )
    elif 55 <= score < 70:
        # FIX 8.5: Only override exit if AI has HIGH confidence
        if ai_action == "EXIT" and ai_reasoning:
            ai_confidence = ai_result.get("confidence", "LOW") if ai_result else "LOW"
            if ai_confidence == "HIGH":
                return ReEvalResult(
                    action="EXIT",
                    re_entry_score=score,
                    re_entry_grade=grade,
                    reason=f"Score dropped to {score:.0f} + AI HIGH-confidence exit recommendation",
                    tighten_stop=False,
                    override_exit=True,
                    override_reason="ai_exit_recommendation_high_confidence",
                    ai_reasoning=ai_reasoning,
                )
            else:
                # LOW/MEDIUM confidence EXIT → just tighten, don't force exit
                return ReEvalResult(
                    action="WATCH",
                    re_entry_score=score,
                    re_entry_grade=grade,
                    reason=f"Score {score:.0f} + AI suggests exit ({ai_confidence} confidence) — tightening stop",
                    tighten_stop=True,
                    override_exit=False,
                    ai_reasoning=f"[{ai_confidence} confidence] {ai_reasoning}",
                )
        return ReEvalResult(
            action="WATCH",
            re_entry_score=score,
            re_entry_grade=grade,
            reason=f"Score dropped to {score:.0f} ({grade.value}) — WATCH, stop tightened 10%",
            tighten_stop=True,
            override_exit=False,
            ai_reasoning=ai_reasoning,
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
            ai_reasoning=ai_reasoning,
        )
