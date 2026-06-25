"""Engine 18: AI Trade Coach — runs 4PM daily, charge drag is the headline metric.

Must answer:
- % of gross consumed by charges today
- minimum % move needed to break even at today's tier
- is current tier viable (explicit rec if charge_drag > 60% on 3+ of last 5 days)
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Optional

from tradepilot.config import ENABLE_ENGINE18_COACH
from tradepilot.database import get_db
from tradepilot.layer2.engine21_growth import get_growth_state


@dataclass
class CoachReport:
    date: str
    charge_drag_today_pct: float  # charges / gross × 100
    min_breakeven_move_pct: float  # avg charges / avg exposure × 100
    tier_viable: bool
    tier_viable_reason: str
    headline: str
    recommendations: list[str]
    capital_update: dict


async def generate_coach_report() -> CoachReport:
    """Generate the 4PM daily coaching report. AI-enhanced when available."""
    if not ENABLE_ENGINE18_COACH:
        return CoachReport(
            date=date.today().isoformat(),
            charge_drag_today_pct=0, min_breakeven_move_pct=0,
            tier_viable=True, tier_viable_reason="Engine 18 disabled",
            headline="Coach report disabled", recommendations=[],
            capital_update={},
        )

    today = date.today().isoformat()
    growth = await get_growth_state()

    async with get_db() as db:
        # Today's trades
        row = await db.execute(
            """SELECT SUM(gross_pnl) as gross, SUM(total_charges) as charges,
                SUM(net_pnl) as net, COUNT(*) as cnt,
                SUM(CASE WHEN was_profitable=1 THEN 1 ELSE 0 END) as wins,
                AVG(capital_used * leverage) as avg_exposure,
                MAX(net_pnl) as best, MIN(net_pnl) as worst,
                AVG(hold_duration_min) as avg_hold
            FROM trades WHERE status = 'CLOSED' AND date = ?""",
            (today,),
        )
        data = await row.fetchone()

        gross = data["gross"] or 0
        charges = data["charges"] or 0
        net = data["net"] or 0
        count = data["cnt"] or 0
        wins = data["wins"] or 0
        avg_exposure = data["avg_exposure"] or 0
        best_trade = data["best"] or 0
        worst_trade = data["worst"] or 0
        avg_hold = data["avg_hold"] or 0

        charge_drag = (charges / abs(gross) * 100) if abs(gross) > 0 else 0
        breakeven_pct = (charges / avg_exposure * 100) if avg_exposure > 0 and count > 0 else 0
        win_rate = (wins / count * 100) if count > 0 else 0

        # Check last 5 days for tier viability
        five_days_ago = (date.today() - timedelta(days=5)).isoformat()
        rows = await db.execute(
            """SELECT date, SUM(total_charges) as charges, SUM(gross_pnl) as gross
            FROM trades WHERE status = 'CLOSED' AND date >= ?
            GROUP BY date""",
            (five_days_ago,),
        )
        high_drag_days = 0
        async for r in rows:
            day_gross = r["gross"] or 0
            day_charges = r["charges"] or 0
            if abs(day_gross) > 0 and (day_charges / abs(day_gross) * 100) > 60:
                high_drag_days += 1

        # Weekly win rate
        week_ago = (date.today() - timedelta(days=7)).isoformat()
        weekly_row = await db.execute(
            """SELECT COUNT(*) as cnt, SUM(CASE WHEN was_profitable=1 THEN 1 ELSE 0 END) as wins
            FROM trades WHERE status = 'CLOSED' AND date >= ?""",
            (week_ago,),
        )
        weekly_data = await weekly_row.fetchone()
        weekly_wr = ((weekly_data["wins"] or 0) / (weekly_data["cnt"] or 1) * 100)

        # Get consecutive losses from daily_state
        daily_row = await db.execute(
            "SELECT consecutive_losses FROM daily_state WHERE date = ?", (today,)
        )
        daily_state = await daily_row.fetchone()
        consecutive_losses = daily_state["consecutive_losses"] if daily_state else 0

    tier_viable = high_drag_days < 3
    tier_reason = ""
    recommendations = []

    # --- AI-ENHANCED COACHING ---
    ai_coaching = None
    if count > 0:
        try:
            from tradepilot.layer2.engine_ai import ai_coach_insights
            from tradepilot.orchestrator import get_state
            state = get_state()
            market_mode = state.market_mode.value if state.market_mode else "NORMAL"

            ai_coaching = await ai_coach_insights({
                "trade_count": count,
                "net_pnl": net,
                "gross_pnl": gross,
                "charges": charges,
                "charge_drag": charge_drag,
                "win_rate": win_rate,
                "capital": growth.current_capital,
                "tier": growth.current_tier.value,
                "best_trade": best_trade,
                "worst_trade": worst_trade,
                "avg_hold": avg_hold,
                "market_mode": market_mode,
                "weekly_wr": weekly_wr,
                "drag_trend": "rising" if high_drag_days >= 3 else "stable",
                "consecutive_losses": consecutive_losses,
            })
        except Exception as e:
            logger.debug("AI coaching unavailable: %s", str(e)[:60])

    # Use AI recommendations if available, otherwise fall back to rule-based
    if ai_coaching:
        headline = ai_coaching.get("headline", "")
        recommendations = ai_coaching.get("recommendations", [])
        if ai_coaching.get("mindset_tip"):
            recommendations.append(f"💡 {ai_coaching['mindset_tip']}")
        if not headline:
            headline = _build_fallback_headline(charge_drag, breakeven_pct, tier_viable, count)
    else:
        headline = _build_fallback_headline(charge_drag, breakeven_pct, tier_viable, count)
        if not tier_viable:
            recommendations = [
                "Reduce trade frequency (fewer, higher-quality entries)",
                "Raise minimum composite score to 80+ (stricter filter)",
                "Wait for tier growth (charges become proportionally smaller)",
            ]

    if not tier_viable:
        tier_reason = (
            f"Charge drag >60% on {high_drag_days}/5 recent days. "
            "Consider: reduce trade frequency, raise minimum score threshold, "
            "or wait for capital growth to improve charge economics."
        )
    else:
        tier_reason = "Charge economics acceptable for current tier"

    return CoachReport(
        date=today,
        charge_drag_today_pct=round(charge_drag, 1),
        min_breakeven_move_pct=round(breakeven_pct, 2),
        tier_viable=tier_viable,
        tier_viable_reason=tier_reason,
        headline=headline,
        recommendations=recommendations,
        capital_update={
            "current_capital": growth.current_capital,
            "current_tier": growth.current_tier.value,
            "progress": growth.progress_pct_to_next_tier,
        },
    )


def _build_fallback_headline(charge_drag: float, breakeven_pct: float, tier_viable: bool, count: int) -> str:
    """Build headline when AI is unavailable."""
    if count == 0:
        return "No trades today."
    return (
        f"Charges ate {charge_drag:.0f}% of gross today. "
        f"Needed {breakeven_pct:.1f}% move to break even. "
        f"{'Tier viable.' if tier_viable else 'TIER VIABILITY CONCERN.'}"
    )
