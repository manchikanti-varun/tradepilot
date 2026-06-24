"""Engine 3: Market Breadth — advance/decline ratio, sectoral strength.

Measures internal market health beyond just the Nifty index level.
Wide breadth (many stocks advancing) = healthier rally, safer entries.
Narrow breadth (index up but most stocks down) = risky, reduce size.
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from tradepilot.config import ENABLE_ENGINE3_BREADTH


@dataclass
class BreadthData:
    date: str
    advances: int
    declines: int
    unchanged: int
    advance_decline_ratio: float  # >1.5 = healthy, <0.7 = weak
    top_sectors: list[str]  # ranked by intraday performance
    avoid_sectors: list[str]  # bottom 2-3 sectors
    breadth_signal: str  # "HEALTHY", "NARROW", "WEAK"
    size_modifier: float  # 1.0, 0.8, or 0.6


def compute_breadth(
    advances: int,
    declines: int,
    unchanged: int,
    sector_returns: dict[str, float],  # {"IT": 1.2, "Banking": -0.3, ...}
) -> BreadthData:
    """
    Compute market breadth signal.

    Rules:
    - A/D ratio > 1.5 → HEALTHY (no size reduction)
    - A/D ratio 0.8-1.5 → NARROW (size × 0.8 for non-top-sector stocks)
    - A/D ratio < 0.8 → WEAK (size × 0.6, only top-sector stocks)
    """
    if not ENABLE_ENGINE3_BREADTH:
        return BreadthData(
            date=date.today().isoformat(),
            advances=0, declines=0, unchanged=0,
            advance_decline_ratio=1.0,
            top_sectors=[], avoid_sectors=[],
            breadth_signal="HEALTHY", size_modifier=1.0,
        )

    total = advances + declines + unchanged
    ad_ratio = advances / declines if declines > 0 else 2.0

    # Sector ranking
    sorted_sectors = sorted(sector_returns.items(), key=lambda x: x[1], reverse=True)
    top_sectors = [s[0] for s in sorted_sectors[:3] if s[1] > 0]
    avoid_sectors = [s[0] for s in sorted_sectors[-2:] if s[1] < -0.5]

    if ad_ratio > 1.5:
        signal = "HEALTHY"
        modifier = 1.0
    elif ad_ratio >= 0.8:
        signal = "NARROW"
        modifier = 0.8
    else:
        signal = "WEAK"
        modifier = 0.6

    return BreadthData(
        date=date.today().isoformat(),
        advances=advances,
        declines=declines,
        unchanged=unchanged,
        advance_decline_ratio=round(ad_ratio, 2),
        top_sectors=top_sectors,
        avoid_sectors=avoid_sectors,
        breadth_signal=signal,
        size_modifier=modifier,
    )


# Placeholder cache
_cached_breadth: Optional[BreadthData] = None


async def get_market_breadth() -> BreadthData:
    """Get current market breadth (updated periodically during market hours)."""
    global _cached_breadth
    if _cached_breadth and _cached_breadth.date == date.today().isoformat():
        return _cached_breadth

    # TODO: Scrape from NSE market stats or use pre-open data
    # Returns healthy default until wired
    _cached_breadth = BreadthData(
        date=date.today().isoformat(),
        advances=0, declines=0, unchanged=0,
        advance_decline_ratio=1.0,
        top_sectors=[], avoid_sectors=[],
        breadth_signal="HEALTHY", size_modifier=1.0,
    )
    return _cached_breadth
