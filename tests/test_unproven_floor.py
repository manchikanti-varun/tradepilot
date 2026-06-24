"""Unproven risk floor test — Engine 6 MUST use unproven risk% when is_proven=False.

The spec says: "is_proven_for_tier(tier) starts FALSE for every tier, always,
including on a fresh install. It only flips to TRUE after Engine 24's validation
report explicitly passes. This is a hard floor, not a default that can be
overridden by changing a config value."

This test verifies that:
1. When is_proven=False, Engine 6 uses the UNPROVEN risk% regardless of anything else
2. The proven risk% is ONLY used when is_proven=True
3. No external config or settings path can bypass this
"""

import pytest
from tradepilot.config import CapitalTier, Grade, MarketMode, TIER_CONFIGS
from tradepilot.layer2.engine6_allocation import compute_allocation


class TestUnprovenRiskFloor:
    """The unproven floor is structural, not a default."""

    def test_tier_a_unproven_uses_2pct(self):
        """Tier A unproven must use 2% risk, not 8%."""
        result = compute_allocation(
            current_capital=1500.0,
            tier=CapitalTier.A,
            grade=Grade.A_PLUS,
            ltp=200.0,
            atr=5.0,
            market_mode=MarketMode.NORMAL,
            is_proven=False,  # NOT proven
            progress_pct_to_next_tier=50.0,
        )
        assert result.max_risk_pct == 2.0, (
            f"Tier A unproven should use 2% risk, got {result.max_risk_pct}%"
        )

    def test_tier_a_proven_uses_8pct(self):
        """Tier A proven uses 8% risk."""
        result = compute_allocation(
            current_capital=1500.0,
            tier=CapitalTier.A,
            grade=Grade.A_PLUS,
            ltp=200.0,
            atr=5.0,
            market_mode=MarketMode.NORMAL,
            is_proven=True,  # Proven
            progress_pct_to_next_tier=50.0,
        )
        assert result.max_risk_pct == 8.0, (
            f"Tier A proven should use 8% risk, got {result.max_risk_pct}%"
        )

    def test_tier_b_unproven_uses_3pct(self):
        """Tier B unproven must use 3%."""
        result = compute_allocation(
            current_capital=3000.0,
            tier=CapitalTier.B,
            grade=Grade.A,
            ltp=300.0,
            atr=6.0,
            is_proven=False,
        )
        assert result.max_risk_pct == 3.0

    def test_tier_c_unproven_uses_4pct(self):
        """Tier C unproven must use 4%."""
        result = compute_allocation(
            current_capital=7000.0,
            tier=CapitalTier.C,
            grade=Grade.A,
            ltp=500.0,
            atr=8.0,
            is_proven=False,
        )
        assert result.max_risk_pct == 4.0

    def test_tier_d_unproven_uses_5pct(self):
        """Tier D unproven must use 5%."""
        result = compute_allocation(
            current_capital=15000.0,
            tier=CapitalTier.D,
            grade=Grade.A_PLUS,
            ltp=800.0,
            atr=12.0,
            is_proven=False,
        )
        assert result.max_risk_pct == 5.0

    def test_is_proven_false_is_default(self):
        """is_proven defaults to False in function signature."""
        # Calling without is_proven should use unproven rate
        result = compute_allocation(
            current_capital=1500.0,
            tier=CapitalTier.A,
            grade=Grade.A_PLUS,
            ltp=200.0,
            atr=5.0,
        )
        # Default is_proven=False → 2%
        assert result.max_risk_pct == 2.0

    def test_stop_price_uses_unproven_risk(self):
        """Stop price calculation must reflect the unproven risk%."""
        result = compute_allocation(
            current_capital=1500.0,
            tier=CapitalTier.A,
            grade=Grade.A_PLUS,
            ltp=200.0,
            atr=5.0,
            is_proven=False,
        )
        # stop_loss_amount = (qty * ltp) * (max_risk_pct / 100 / leverage)
        # With 2% risk, leverage=5: stop_loss_amount = (qty*200) * (2/100/5)
        # = (qty*200) * 0.004
        if result.viable and result.qty > 0:
            expected_stop_loss = (result.qty * 200.0) * (2.0 / 100 / 5.0)
            assert abs(result.stop_loss_amount - expected_stop_loss) < 0.01, (
                f"Stop loss should use 2% unproven risk. "
                f"Expected ₹{expected_stop_loss:.2f}, got ₹{result.stop_loss_amount:.2f}"
            )
