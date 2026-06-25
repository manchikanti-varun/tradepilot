"""Engine 1: Market Data Stream (trimmed for MVP — Nifty + watchlist LTPs only).

Phase 1 adds: FII/DII data, sectoral indices, broader market internals.
For MVP, this is a thin wrapper that delegates to Layer 1's MarketDataProvider.
"""

import logging
from typing import Optional
from datetime import datetime

from tradepilot.layer1.base import MarketDataProvider

# FIX 1.1: Add logging and staleness detection
logger = logging.getLogger(__name__)


class MarketDataStream:
    """Thin wrapper for MVP — just delegates to provider. Phase 1 adds WebSocket."""

    def __init__(self, provider: MarketDataProvider):
        self.provider = provider
        self.last_nifty: float = 0.0
        self.last_vix: float = 14.0
        self.nifty_open: Optional[float] = None
        self.last_update: Optional[datetime] = None

    async def refresh(self):
        """Refresh core market data."""
        try:
            self.last_nifty = await self.provider.get_nifty_value()
            self.last_vix = await self.provider.get_vix()
            if self.nifty_open is None:
                self.nifty_open = self.last_nifty
            self.last_update = datetime.now()
        except Exception as e:
            # FIX 1.1: Log the exception instead of silently swallowing
            logger.warning("Market data refresh failed (data may be stale): %s", str(e)[:100])

    @property
    def is_stale(self) -> bool:
        """FIX 1.1: True if data is older than 180 seconds or never fetched."""
        if self.last_update is None:
            return True
        return (datetime.now() - self.last_update).total_seconds() > 180

    @property
    def nifty_change_pct(self) -> float:
        """Nifty % change from open."""
        if self.nifty_open and self.nifty_open > 0:
            return (self.last_nifty - self.nifty_open) / self.nifty_open * 100
        return 0.0

    @property
    def is_high_vol(self) -> bool:
        return self.last_vix > 22

    @property
    def is_caution_vol(self) -> bool:
        return 17 <= self.last_vix <= 22
