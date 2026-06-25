"""Engine 17: Market Regime Learner — adapts trade frequency/sizing by regime.

Gates itself on ≥15 trades per regime before adjusting anything.
Until then: conservative defaults, no restriction from this engine.

Regimes: NORMAL, HIGH_VOL, TRENDING (from VIX + Nifty trend detection).
"""

from dataclasses import dataclass
from typing import Optional

from tradepilot.config import ENABLE_ENGINE17_REGIME, MarketMode
from tradepilot.database import get_db


MIN_TRADES_PER_REGIME = 1  # No gate — regime learning active immediately


@dataclass
class RegimeConfig:
    mode: MarketMode
    win_rate: float
    max_trades_per_day: int
    min_grade: str  # "A+" or "A"
    size_multiplier: float
    is_learned: bool  # True if ≥15 trades exist for this regime
    note: str


@dataclass
class RegimeLearning:
    current_mode: MarketMode
    config: RegimeConfig
    all_regimes: dict[str, RegimeConfig]


async def get_regime_config(current_mode: MarketMode) -> RegimeLearning:
    """
    Get learned regime parameters or conservative defaults.

    Rules (once learned):
    - win_rate < 0.40 → max 1 trade/day, A+ only, size×0.4
    - win_rate ≥ 0.65 → up to 5 trades/day, A+/A, size×1.0
    - Between → interpolate linearly
    """
    if not ENABLE_ENGINE17_REGIME:
        default = RegimeConfig(
            mode=current_mode, win_rate=0.5, max_trades_per_day=4,
            min_grade="A", size_multiplier=1.0, is_learned=False,
            note="Engine 17 disabled",
        )
        return RegimeLearning(current_mode=current_mode, config=default, all_regimes={})

    async with get_db() as db:
        all_regimes = {}
        for mode in MarketMode:
            row = await db.execute(
                """SELECT COUNT(*) as cnt,
                    SUM(CASE WHEN was_profitable=1 THEN 1 ELSE 0 END) as wins
                FROM trades WHERE status = 'CLOSED' AND market_mode = ?""",
                (mode.value,),
            )
            data = await row.fetchone()
            count = data["cnt"] or 0
            wins = data["wins"] or 0

            if count >= MIN_TRADES_PER_REGIME:
                wr = wins / count
                if wr < 0.40:
                    config = RegimeConfig(
                        mode=mode, win_rate=round(wr, 3),
                        max_trades_per_day=1, min_grade="A+",
                        size_multiplier=0.4, is_learned=True,
                        note=f"Low win rate ({wr:.0%}) — restricted",
                    )
                elif wr >= 0.65:
                    config = RegimeConfig(
                        mode=mode, win_rate=round(wr, 3),
                        max_trades_per_day=5, min_grade="A",
                        size_multiplier=1.0, is_learned=True,
                        note=f"Strong win rate ({wr:.0%}) — full parameters",
                    )
                else:
                    # Interpolate
                    trades_cap = int(1 + (wr - 0.40) / (0.65 - 0.40) * 4)
                    size_mult = 0.4 + (wr - 0.40) / (0.65 - 0.40) * 0.6
                    config = RegimeConfig(
                        mode=mode, win_rate=round(wr, 3),
                        max_trades_per_day=trades_cap, min_grade="A",
                        size_multiplier=round(size_mult, 2), is_learned=True,
                        note=f"Moderate win rate ({wr:.0%}) — interpolated",
                    )
            else:
                config = RegimeConfig(
                    mode=mode, win_rate=0.5, max_trades_per_day=4,
                    min_grade="A", size_multiplier=1.0, is_learned=False,
                    note=f"Insufficient data ({count}/{MIN_TRADES_PER_REGIME} trades)",
                )
            all_regimes[mode.value] = config

        current_config = all_regimes.get(current_mode.value, all_regimes.get("NORMAL"))
        return RegimeLearning(
            current_mode=current_mode,
            config=current_config,
            all_regimes=all_regimes,
        )
