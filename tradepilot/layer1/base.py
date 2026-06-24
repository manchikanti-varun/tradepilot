"""Abstract base for all market data providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import pandas as pd


@dataclass
class Instrument:
    symbol: str
    name: str
    sector: str
    exchange: str = "NSE"
    isin: Optional[str] = None


@dataclass
class DepthSnapshot:
    """Market depth (top 5 bid/ask)."""
    bids: list[tuple[float, int]]  # [(price, qty), ...]
    asks: list[tuple[float, int]]
    timestamp: datetime


class MarketDataProvider(ABC):
    """Abstract interface for Layer 1. Layer 2 depends ONLY on this contract."""

    @abstractmethod
    async def get_ltp(self, symbol: str) -> float:
        """Get last traded price."""
        ...

    @abstractmethod
    async def get_candles(
        self, symbol: str, interval: str, from_dt: datetime, to_dt: datetime
    ) -> pd.DataFrame:
        """
        Get OHLCV candles. Returns DataFrame with columns:
        [timestamp, open, high, low, close, volume]
        — same shape regardless of provider.
        """
        ...

    @abstractmethod
    async def get_market_depth(self, symbol: str) -> DepthSnapshot:
        """Get top-5 bid/ask depth."""
        ...

    @abstractmethod
    async def get_instrument_list(self) -> list[Instrument]:
        """Get full instrument universe."""
        ...

    @abstractmethod
    async def get_nifty_value(self) -> float:
        """Get current Nifty 50 index value."""
        ...

    @abstractmethod
    async def get_vix(self) -> float:
        """Get current India VIX value."""
        ...
