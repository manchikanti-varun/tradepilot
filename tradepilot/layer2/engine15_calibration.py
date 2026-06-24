"""Engine 15: Confidence Calibration — adjusts predicted win rates to actual.

Deferred until ≥50 trades exist. Even with feature flag ON, this engine
gates itself on data sufficiency: needs ≥20 trades per score bucket.
Default pre-data calibration_factor = 0.75 (conservative).
Never shows >90% confidence in UI.
"""

from dataclasses import dataclass
from typing import Optional

from tradepilot.config import ENABLE_ENGINE15_CALIBRATION
from tradepilot.database import get_db


SCORE_BUCKETS = [(65, 75), (75, 85), (85, 100)]
MIN_TRADES_PER_BUCKET = 20
DEFAULT_CALIBRATION_FACTOR = 0.75
MAX_DISPLAYED_CONFIDENCE = 0.90


@dataclass
class CalibrationResult:
    bucket_factors: dict[str, float]  # {"65-75": 0.8, "75-85": 0.95, "85-100": 1.1}
    global_factor: float
    total_trades_analyzed: int
    is_active: bool  # False if insufficient data
    note: str


async def get_calibration_factors() -> CalibrationResult:
    """
    Compute calibration factors per score bucket.
    calibration_factor[bucket] = actual_win_rate / predicted_win_rate

    Only active when ≥20 trades exist per bucket.
    """
    if not ENABLE_ENGINE15_CALIBRATION:
        return CalibrationResult(
            bucket_factors={}, global_factor=DEFAULT_CALIBRATION_FACTOR,
            total_trades_analyzed=0, is_active=False,
            note="Engine 15 disabled via feature flag",
        )

    async with get_db() as db:
        # Count total trades
        row = await db.execute("SELECT COUNT(*) as cnt FROM trades WHERE status = 'CLOSED'")
        data = await row.fetchone()
        total = data["cnt"] or 0

        if total < 50:
            return CalibrationResult(
                bucket_factors={}, global_factor=DEFAULT_CALIBRATION_FACTOR,
                total_trades_analyzed=total, is_active=False,
                note=f"Insufficient data ({total}/50 trades). Using default factor {DEFAULT_CALIBRATION_FACTOR}",
            )

        # Compute per-bucket
        bucket_factors = {}
        all_active = True

        for low, high in SCORE_BUCKETS:
            bucket_key = f"{low}-{high}"
            row = await db.execute(
                """SELECT COUNT(*) as cnt,
                    SUM(CASE WHEN was_profitable = 1 THEN 1 ELSE 0 END) as wins
                FROM trades WHERE status = 'CLOSED'
                AND composite_score >= ? AND composite_score < ?""",
                (low, high),
            )
            bdata = await row.fetchone()
            bucket_count = bdata["cnt"] or 0
            bucket_wins = bdata["wins"] or 0

            if bucket_count < MIN_TRADES_PER_BUCKET:
                all_active = False
                bucket_factors[bucket_key] = DEFAULT_CALIBRATION_FACTOR
            else:
                actual_wr = bucket_wins / bucket_count
                # Predicted win rate is roughly score/100 (simplified model)
                predicted_wr = (low + high) / 2 / 100
                factor = actual_wr / predicted_wr if predicted_wr > 0 else DEFAULT_CALIBRATION_FACTOR
                bucket_factors[bucket_key] = round(min(factor, 1.5), 3)  # cap to prevent runaway

        # Global factor (fallback)
        row = await db.execute(
            "SELECT COUNT(*) as cnt, SUM(CASE WHEN was_profitable=1 THEN 1 ELSE 0 END) as wins "
            "FROM trades WHERE status = 'CLOSED'"
        )
        gdata = await row.fetchone()
        global_wr = (gdata["wins"] or 0) / (gdata["cnt"] or 1)
        global_factor = global_wr / 0.6  # assume predicted avg ~60%

        return CalibrationResult(
            bucket_factors=bucket_factors,
            global_factor=round(min(global_factor, 1.5), 3),
            total_trades_analyzed=total,
            is_active=all_active,
            note="Active" if all_active else f"Partial — some buckets below {MIN_TRADES_PER_BUCKET} trades",
        )


def apply_calibration(avg_net: float, composite_score: float, factors: CalibrationResult) -> float:
    """Apply calibration factor to a simulated avg_net."""
    if not factors.is_active:
        return avg_net * DEFAULT_CALIBRATION_FACTOR

    # Find matching bucket
    for (low, high) in SCORE_BUCKETS:
        if low <= composite_score < high:
            key = f"{low}-{high}"
            factor = factors.bucket_factors.get(key, factors.global_factor)
            return avg_net * factor

    return avg_net * factors.global_factor
