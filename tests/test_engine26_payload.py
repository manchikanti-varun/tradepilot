"""Engine 26 payload test — Phase 0 must OMIT event_calendar and yesterday_recap.

Spec: "Engine 26 still runs, but omits 'event_calendar_today' and 'yesterday_recap'
from the payload entirely rather than sending empty/null placeholders that look like
'nothing happening' when the real answer is 'not tracked yet'."
"""

import pytest
from tradepilot.config import RiskGate, CapitalTier
from tradepilot.layer2.engine21_growth import GrowthState
from tradepilot.layer2.engine26_brief import build_morning_brief


class TestEngine26Phase0Payload:
    """Verify MVP-lite payload omits Phase 1 fields entirely."""

    def _make_growth_state(self):
        return GrowthState(
            current_capital=1500.0,
            current_tier=CapitalTier.A,
            next_tier_threshold=2000.0,
            progress_pct_to_next_tier=50.0,
            days_to_next_tier_at_current_rate=999,
            peak_capital=1500.0,
            drawdown_from_peak_pct=0.0,
            capital_last_confirmed="2026-06-24T10:00:00",
            is_proven=False,
        )

    def test_phase0_brief_omits_event_calendar(self):
        """event_calendar_today must be None (absent from JSON) in Phase 0."""
        brief = build_morning_brief(
            growth_state=self._make_growth_state(),
            watchlist_scores=[],
            risk_gate=RiskGate.GO,
            risk_reason=None,
            trades_remaining=4,
            # Phase 1 args NOT provided → None
        )
        assert brief.event_calendar_today is None, (
            "Phase 0 brief must have event_calendar_today=None (omitted from API response)"
        )

    def test_phase0_brief_omits_yesterday_recap(self):
        """yesterday_recap must be None (absent from JSON) in Phase 0."""
        brief = build_morning_brief(
            growth_state=self._make_growth_state(),
            watchlist_scores=[],
            risk_gate=RiskGate.GO,
            risk_reason=None,
            trades_remaining=4,
        )
        assert brief.yesterday_recap is None, (
            "Phase 0 brief must have yesterday_recap=None (omitted from API response)"
        )

    def test_phase0_brief_has_required_fields(self):
        """Phase 0 brief MUST contain capital, watchlist, risk, one_line_summary."""
        brief = build_morning_brief(
            growth_state=self._make_growth_state(),
            watchlist_scores=[],
            risk_gate=RiskGate.GO,
            risk_reason=None,
            trades_remaining=4,
        )
        assert brief.capital_snapshot is not None
        assert brief.watchlist_summary is not None
        assert brief.risk_state is not None
        assert brief.one_line_summary is not None
        assert len(brief.one_line_summary) > 0

    def test_phase1_brief_includes_events_when_provided(self):
        """When Phase 1 provides events, they appear in the brief."""
        events = [{"time": "10:00", "event": "RBI MPC", "impact": "HIGH"}]
        brief = build_morning_brief(
            growth_state=self._make_growth_state(),
            watchlist_scores=[],
            risk_gate=RiskGate.GO,
            risk_reason=None,
            trades_remaining=4,
            events_today=events,
            yesterday_pnl=42.0,
            yesterday_charge_drag=38.0,
            yesterday_verdict="+₹42 net",
        )
        assert brief.event_calendar_today is not None
        assert len(brief.event_calendar_today) == 1
        assert brief.yesterday_recap is not None
        assert brief.yesterday_recap["net_pnl"] == 42.0
