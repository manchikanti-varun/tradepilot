"""Hybrid Data Provider — yfinance for bulk scanning + Angel One for real-time.

Strategy:
- Scanning (every 3 min, 200 stocks): Uses yfinance (unlimited, 1-2 min delay)
- Real-time LTP (when user taps a stock): Uses Angel One (zero delay)
- Market depth: Angel One only (for top candidates)
- Candles for analysis: yfinance (unlimited)
- VIX/Nifty: Angel One (few calls, very valuable)

This maximizes coverage (all 200 stocks) while keeping Angel One's
2800 daily calls for what matters — real-time decisions.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd

from tradepilot.layer1.base import MarketDataProvider, Instrument, DepthSnapshot
from tradepilot.layer1.yahoo_provider import YahooFinanceProvider
from tradepilot.layer1.angel_provider import AngelOneProvider

logger = logging.getLogger(__name__)


class HybridProvider(MarketDataProvider):
    """Hybrid: yfinance for bulk + Angel One for real-time.
    
    - get_ltp: Angel One (real-time, counts toward daily limit)
    - get_candles: yfinance (unlimited, used for scoring 200 stocks)
    - get_market_depth: Angel One (real bid/ask)
    - get_instrument_list: From DB/NSE universe
    - get_nifty_value: Angel One
    - get_vix: yfinance (reliable for VIX)
    - get_bulk_ltp: yfinance (for scanning all 200)
    """

    def __init__(self):
        self._yahoo = YahooFinanceProvider()
        self._angel = AngelOneProvider()
        logger.info("HybridProvider initialized: yfinance (bulk) + Angel One (real-time)")

    async def get_ltp(self, symbol: str) -> float:
        """Real-time LTP from Angel One. Falls back to yfinance."""
        try:
            price = await self._angel.get_ltp(symbol)
            if price > 0:
                return price
        except Exception:
            pass
        return await self._yahoo.get_ltp(symbol)

    async def get_candles(
        self, symbol: str, interval: str, from_dt: datetime, to_dt: datetime
    ) -> pd.DataFrame:
        """Candles from yfinance (unlimited). Angel One only if yfinance fails."""
        result = await self._yahoo.get_candles(symbol, interval, from_dt, to_dt)
        if not result.empty:
            return result
        # Fallback to Angel One
        return await self._angel.get_candles(symbol, interval, from_dt, to_dt)

    async def get_market_depth(self, symbol: str) -> DepthSnapshot:
        """Real market depth from Angel One."""
        try:
            return await self._angel.get_market_depth(symbol)
        except Exception:
            return await self._yahoo.get_market_depth(symbol)

    async def get_instrument_list(self) -> list[Instrument]:
        """Full 200 stock universe — no limit concerns."""
        return await self._yahoo.get_instrument_list()

    async def get_nifty_value(self) -> float:
        """Nifty from Angel One (real-time)."""
        try:
            val = await self._angel.get_nifty_value()
            if val > 0:
                return val
        except Exception:
            pass
        return await self._yahoo.get_nifty_value()

    async def get_vix(self) -> float:
        """VIX from yfinance (more reliable)."""
        return await self._yahoo.get_vix()

    async def get_bulk_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Bulk LTP from yfinance for scanning. Saves Angel One calls."""
        return await self._yahoo.get_bulk_ltp(symbols)
