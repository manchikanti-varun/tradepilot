"""Engine 26: Morning Brief — synthesizes "here's where things stand" before market open.

Runs: 08:45 AM IST daily. MVP-LITE mode (Phase 0): capital + watchlist + risk only.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from tradepilot.config import CapitalTier, RiskGate
from tradepilot.layer2.engine21_growth import GrowthState


@dataclass
class WatchlistSummary:
    total_candidates: int
    top_3_by_score: list[dict]  # [{ticker, composite, grade, sector}]
    sector_tilt: str


@dataclass
class RiskStateSummary:
    mode: str  # "GO", "CAUTION", "HARD_STOP"
    reason_if_not_go: Optional[str]
    trades_remaining_today: int


@dataclass
class MorningBrief:
    date: str
    capital_snapshot: dict
    watchlist_summary: dict
    risk_state: dict
    one_line_summary: str
    # Phase 1+ fields (None in MVP-lite)
    event_calendar_today: Optional[list[dict]] = None
    yesterday_recap: Optional[dict] = None


def build_morning_brief(
    growth_state: GrowthState,
    watchlist_scores: list,  # list[StockScore] from Engine 4
    risk_gate: RiskGate,
    risk_reason: Optional[str],
    trades_remaining: int,
    # Phase 1 (optional)
    events_today: Optional[list[dict]] = None,
    yesterday_pnl: Optional[float] = None,
    yesterday_charge_drag: Optional[float] = None,
    yesterday_verdict: Optional[str] = None,
) -> MorningBrief:
    """
    Build the morning brief. MVP-lite: only capital, watchlist, risk, summary.
    """
    today = datetime.now().strftime("%Y-%m-%d")

    # Capital snapshot
    capital_snapshot = {
        "current_capital": growth_state.current_capital,
        "current_tier": growth_state.current_tier.value,
        "progress_pct_to_next_tier": growth_state.progress_pct_to_next_tier,
        "drawdown_from_peak_pct": growth_state.drawdown_from_peak_pct,
        "capital_last_confirmed": growth_state.capital_last_confirmed,
    }

    # Watchlist summary
    top_3 = []
    sector_counts: dict[str, int] = {}
    for score in watchlist_scores[:3]:
        top_3.append({
            "ticker": score.symbol,
            "composite": score.composite,
            "grade": score.grade.value,
            "sector": score.sector,
        })
    for score in watchlist_scores:
        sector_counts[score.sector] = sector_counts.get(score.sector, 0) + 1

    sector_tilt = max(sector_counts, key=sector_counts.get) if sector_counts else "mixed"

    watchlist_summary = {
        "total_candidates": len(watchlist_scores),
        "top_3_by_score": top_3,
        "sector_tilt": sector_tilt,
    }

    # Risk state
    risk_state = {
        "mode": risk_gate.value,
        "reason_if_not_go": risk_reason,
        "trades_remaining_today": trades_remaining,
    }

    # One-line summary (MVP-lite: no events/coach references)
    tier_label = f"Tier {growth_state.current_tier.value}"
    progress = f"{growth_state.progress_pct_to_next_tier:.0f}% to Tier {_next_tier_letter(growth_state.current_tier)}"
    candidates = f"{len(watchlist_scores)} candidates today"
    tilt = f"{sector_tilt}-heavy" if sector_tilt != "mixed" else "mixed sectors"
    risk_note = ""
    if risk_gate == RiskGate.HARD_STOP:
        risk_note = f" Hard stop active: {risk_reason}."
    elif risk_gate == RiskGate.CAUTION:
        risk_note = f" Caution: {risk_reason}."
    else:
        risk_note = " No hard stops active."

    one_line = f"{tier_label}, {progress}. {candidates}, {tilt}.{risk_note}"

    # Phase 1 fields (only include if data exists)
    event_calendar = None
    yesterday_recap = None

    if events_today is not None:
        event_calendar = events_today

    if yesterday_pnl is not None:
        yesterday_recap = {
            "net_pnl": yesterday_pnl,
            "charge_drag_pct": yesterday_charge_drag,
            "verdict_line": yesterday_verdict,
            "tier_viable": (yesterday_charge_drag or 0) < 60,
        }
        # Enrich one-line summary
        one_line += f" Yesterday: {'+'if yesterday_pnl >= 0 else ''}₹{yesterday_pnl:.0f} net"
        if yesterday_charge_drag:
            one_line += f", charges ate {yesterday_charge_drag:.0f}% of gross."

    return MorningBrief(
        date=today,
        capital_snapshot=capital_snapshot,
        watchlist_summary=watchlist_summary,
        risk_state=risk_state,
        one_line_summary=one_line,
        event_calendar_today=event_calendar,
        yesterday_recap=yesterday_recap,
    )


def _next_tier_letter(tier: CapitalTier) -> str:
    """Get next tier letter."""
    mapping = {
        CapitalTier.A: "B",
        CapitalTier.B: "C",
        CapitalTier.C: "D",
        CapitalTier.D: "D+",
    }
    return mapping[tier]
