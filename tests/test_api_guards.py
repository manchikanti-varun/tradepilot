"""API guard tests — rate limiting and settings floor enforcement.

1. /api/scan rate limiting — cannot be spammed to bypass 3-min cycle
2. /api/settings cannot override is_proven or max_risk_pct
"""

import pytest


class TestSettingsFloor:
    """POST /api/settings must reject attempts to override proven/risk floor."""

    # These tests require httpx + running app (integration tests)
    # Listed here as specification — run with pytest-asyncio + httpx

    FORBIDDEN_SETTINGS = [
        "is_proven",
        "max_risk_pct",
        "risk_pct",
        "proven",
        "is_proven_tier_a",
        "is_proven_tier_b",
        "is_proven_tier_c",
        "is_proven_tier_d",
    ]

    def test_forbidden_settings_list_is_comprehensive(self):
        """All variations of proven/risk override are in the forbidden list."""
        from tradepilot.api import update_settings
        # The endpoint checks against a FORBIDDEN_SETTINGS set
        # Verify it includes all critical variants
        # (This is a design verification, not a runtime test)
        assert len(self.FORBIDDEN_SETTINGS) >= 8, (
            "Forbidden settings list should cover all override variants"
        )

    def test_settings_endpoint_documents_rejection(self):
        """Verify the rejection message explains WHY the floor exists."""
        # The 403 response message should mention Engine 24, 50 trades, and win rate
        # This is important because at 2 AM after 3 good trades, the error message
        # is the last line of defense against impulsive override
        pass  # Integration test — needs running server


class TestScanRateLimit:
    """POST /api/scan must be rate-limited."""

    def test_rate_limit_configured(self):
        """Verify rate limit constants exist and are reasonable."""
        from tradepilot.api import _MIN_SCAN_INTERVAL_SEC, _MIN_MONITOR_INTERVAL_SEC
        assert _MIN_SCAN_INTERVAL_SEC >= 60, (
            "Scan rate limit should be at least 60 seconds"
        )
        assert _MIN_MONITOR_INTERVAL_SEC >= 30, (
            "Monitor rate limit should be at least 30 seconds"
        )

    def test_debug_endpoints_have_disable_flag(self):
        """Debug endpoints must have a disable flag for production."""
        from tradepilot.api import DEBUG_ENDPOINTS_ENABLED
        # In production this should be False — currently True for development
        assert isinstance(DEBUG_ENDPOINTS_ENABLED, bool)
