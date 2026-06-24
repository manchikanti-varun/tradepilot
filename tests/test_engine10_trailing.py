"""Engine 10 trailing stop mode-dependency tests.

Spec: trail_stop = peak - atr × trail_atr_mult[mode]
  NORMAL  → 0.35 (standard)
  HIGH_VOL → 0.55 (wider — gives room in volatile markets)
  TRENDING → 0.25 (tighter — rides the trend)
  EXTENDED → 0.6 (always, regardless of mode)

If HIGH_VOL uses the same multiplier as NORMAL, the trailing stop is too tight
in exactly the market conditions where you'd get stopped out prematurely.
"""

import pytest
from datetime import datetime, timedelta
from tradepilot.config import TradePhase, MarketMode, TRAIL_ATR_MULT, TRAIL_ATR_MULT_EXTENDED
from tradepilot.layer2.engine10_exit import evaluate_exit


class TestEngine10TrailingStopModes:
    """Trail stop must vary by market mode."""

    def _make_trailing_position(self, market_mode: MarketMode):
        """Create a position in TRAILING phase and evaluate exit."""
        entry = 100.0
        peak = 105.0  # Profit has triggered TRAILING
        atr = 5.0
        return evaluate_exit(
            entry_price=entry,
            current_ltp=104.0,  # Still in profit, not at stop
            peak_price=peak,
            stop_price=entry - atr * 0.4,  # 98.0
            trail_stop=98.0,  # Initial (will be recalculated)
            atr=atr,
            phase=TradePhase.TRAILING,
            rsi=55.0,
            volume_ratio=1.2,
            macd_hist=0.01,
            vwap=103.0,
            ema9=103.5,
            entry_time=datetime.now() - timedelta(minutes=30),
            market_mode=market_mode,
        )

    def test_normal_mode_trail_multiplier(self):
        """NORMAL mode uses 0.35 × ATR for trail."""
        result = self._make_trailing_position(MarketMode.NORMAL)
        # trail_stop = peak(105) - atr(5) * 0.35 = 105 - 1.75 = 103.25
        expected_trail = 105.0 - 5.0 * TRAIL_ATR_MULT["NORMAL"]
        assert abs(result.trail_stop - expected_trail) < 0.01, (
            f"NORMAL trail should be {expected_trail}, got {result.trail_stop}"
        )

    def test_high_vol_mode_widens_trail(self):
        """HIGH_VOL mode uses 0.55 × ATR — WIDER than NORMAL."""
        result = self._make_trailing_position(MarketMode.HIGH_VOL)
        # trail_stop = peak(105) - atr(5) * 0.55 = 105 - 2.75 = 102.25
        expected_trail = 105.0 - 5.0 * TRAIL_ATR_MULT["HIGH_VOL"]
        assert abs(result.trail_stop - expected_trail) < 0.01, (
            f"HIGH_VOL trail should be {expected_trail}, got {result.trail_stop}"
        )
        # HIGH_VOL trail must be LOWER (wider) than NORMAL
        normal_trail = 105.0 - 5.0 * TRAIL_ATR_MULT["NORMAL"]
        assert result.trail_stop < normal_trail, (
            "HIGH_VOL trail stop must be wider (lower price) than NORMAL"
        )

    def test_trending_mode_tightens_trail(self):
        """TRENDING mode uses 0.25 × ATR — TIGHTER than NORMAL."""
        result = self._make_trailing_position(MarketMode.TRENDING)
        # trail_stop = peak(105) - atr(5) * 0.25 = 105 - 1.25 = 103.75
        expected_trail = 105.0 - 5.0 * TRAIL_ATR_MULT["TRENDING"]
        assert abs(result.trail_stop - expected_trail) < 0.01, (
            f"TRENDING trail should be {expected_trail}, got {result.trail_stop}"
        )
        # TRENDING trail must be HIGHER (tighter) than NORMAL
        normal_trail = 105.0 - 5.0 * TRAIL_ATR_MULT["NORMAL"]
        assert result.trail_stop > normal_trail, (
            "TRENDING trail stop must be tighter (higher price) than NORMAL"
        )

    def test_all_modes_produce_different_trails(self):
        """Each mode produces a distinct trail stop value."""
        normal = self._make_trailing_position(MarketMode.NORMAL)
        high_vol = self._make_trailing_position(MarketMode.HIGH_VOL)
        trending = self._make_trailing_position(MarketMode.TRENDING)

        # All three must be different
        assert normal.trail_stop != high_vol.trail_stop
        assert normal.trail_stop != trending.trail_stop
        assert high_vol.trail_stop != trending.trail_stop

        # Order: TRENDING > NORMAL > HIGH_VOL (tightest to widest)
        assert trending.trail_stop > normal.trail_stop > high_vol.trail_stop

    def test_extended_phase_uses_fixed_multiplier(self):
        """EXTENDED phase always uses 0.6 × ATR regardless of mode."""
        entry = 100.0
        peak = 108.0
        atr = 5.0

        # Force into EXTENDED: TRAILING + RSI<66 + volume>1.2 + TRENDING mode
        result = evaluate_exit(
            entry_price=entry,
            current_ltp=107.0,
            peak_price=peak,
            stop_price=98.0,
            trail_stop=98.0,
            atr=atr,
            phase=TradePhase.TRAILING,  # Will transition to EXTENDED
            rsi=60.0,  # < 66 ✓
            volume_ratio=1.5,  # > 1.2 ✓
            macd_hist=0.01,
            vwap=106.0,
            ema9=106.5,
            entry_time=datetime.now() - timedelta(minutes=60),
            market_mode=MarketMode.TRENDING,  # Required for EXTENDED transition
        )

        # Should transition to EXTENDED, using 0.6 × ATR
        expected_trail = peak - atr * TRAIL_ATR_MULT_EXTENDED  # 108 - 3.0 = 105.0
        if result.phase == TradePhase.EXTENDED:
            assert abs(result.trail_stop - expected_trail) < 0.01, (
                f"EXTENDED trail should be {expected_trail}, got {result.trail_stop}"
            )
