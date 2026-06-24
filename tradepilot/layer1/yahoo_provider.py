"""Yahoo Finance market data provider — free, no API key required.

Production hardening:
- Batch fetches via yf.download() for multiple symbols
- Asyncio semaphore to limit concurrent requests (max 5)
- Exponential backoff on failures
- Graceful degradation (returns cached/stale data on failure, never crashes pipeline)
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import yfinance as yf

from tradepilot.layer1.base import (
    MarketDataProvider,
    Instrument,
    DepthSnapshot,
)
from tradepilot.layer1.nifty_universe import get_universe, get_sector_map, get_symbol_list

logger = logging.getLogger(__name__)

# Concurrency limit — Yahoo Finance throttles aggressively
_SEMAPHORE = asyncio.Semaphore(5)
_MAX_RETRIES = 3
_BACKOFF_BASE = 2.0  # seconds


def _nse_symbol(symbol: str) -> str:
    """Convert symbol to Yahoo Finance NSE format."""
    return f"{symbol}.NS"


async def _run_with_backoff(func, *args, retries: int = _MAX_RETRIES):
    """Execute a blocking function with semaphore + exponential backoff."""
    loop = asyncio.get_event_loop()
    for attempt in range(retries):
        async with _SEMAPHORE:
            try:
                result = await loop.run_in_executor(None, func, *args)
                return result
            except Exception as e:
                if attempt < retries - 1:
                    wait = _BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "Yahoo fetch failed (attempt %d/%d): %s. Retrying in %.1fs",
                        attempt + 1, retries, str(e)[:80], wait,
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error("Yahoo fetch failed after %d attempts: %s", retries, str(e)[:100])
                    raise


class YahooFinanceProvider(MarketDataProvider):
    """Market data from Yahoo Finance. Free, no key required.

    Key production behaviors:
    - LTP cache with 30-sec TTL (avoids hammering Yahoo on repeated calls)
    - Batch download for multiple symbols
    - Never raises on single-stock failure (returns cached or None)
    """

    def __init__(self):
        self._ltp_cache: dict[str, tuple[float, datetime]] = {}
        self._candle_cache: dict[str, tuple[pd.DataFrame, datetime]] = {}
        self._instruments: Optional[list[Instrument]] = None
        self._LTP_CACHE_TTL = timedelta(seconds=30)
        self._CANDLE_CACHE_TTL = timedelta(minutes=3)

    async def get_ltp(self, symbol: str) -> float:
        """Get last traded price. Returns cached value if fresh enough."""
        # Check cache
        if symbol in self._ltp_cache:
            price, ts = self._ltp_cache[symbol]
            if datetime.now() - ts < self._LTP_CACHE_TTL:
                return price

        def _fetch():
            ticker = yf.Ticker(_nse_symbol(symbol))
            info = ticker.fast_info
            return info.get("lastPrice", 0.0) or info.get("previousClose", 0.0)

        try:
            price = await _run_with_backoff(_fetch)
            self._ltp_cache[symbol] = (price, datetime.now())
            return price
        except Exception:
            # Return stale cache if available, else 0
            if symbol in self._ltp_cache:
                logger.warning("Using stale LTP cache for %s", symbol)
                return self._ltp_cache[symbol][0]
            return 0.0

    async def get_candles(
        self, symbol: str, interval: str, from_dt: datetime, to_dt: datetime
    ) -> pd.DataFrame:
        """Get OHLCV candles. Returns cached if within TTL."""
        cache_key = f"{symbol}_{interval}"
        if cache_key in self._candle_cache:
            df, ts = self._candle_cache[cache_key]
            if datetime.now() - ts < self._CANDLE_CACHE_TTL:
                return df

        interval_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d"}
        yf_interval = interval_map.get(interval, "5m")

        def _fetch():
            ticker = yf.Ticker(_nse_symbol(symbol))
            df = ticker.history(
                start=from_dt.strftime("%Y-%m-%d"),
                end=(to_dt + timedelta(days=1)).strftime("%Y-%m-%d"),
                interval=yf_interval,
            )
            if df.empty:
                return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
            df = df.reset_index()
            col_map = {
                "Date": "timestamp", "Datetime": "timestamp",
                "Open": "open", "High": "high", "Low": "low",
                "Close": "close", "Volume": "volume",
            }
            df = df.rename(columns=col_map)
            std_cols = ["timestamp", "open", "high", "low", "close", "volume"]
            available = [c for c in std_cols if c in df.columns]
            return df[available]

        try:
            result = await _run_with_backoff(_fetch)
            self._candle_cache[cache_key] = (result, datetime.now())
            return result
        except Exception:
            # Return stale cache or empty
            if cache_key in self._candle_cache:
                logger.warning("Using stale candle cache for %s", symbol)
                return self._candle_cache[cache_key][0]
            return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

    async def get_market_depth(self, symbol: str) -> DepthSnapshot:
        """
        Yahoo Finance doesn't provide real depth data.
        Returns synthetic depth based on LTP.
        NOTE: This is a DOCUMENTED limitation. Engine 5's bid/ask check
        will effectively auto-pass until a real depth source is wired.
        """
        ltp = await self.get_ltp(symbol)
        if ltp == 0:
            ltp = 100.0  # fallback
        bids = [(round(ltp - 0.05 * i, 2), 1000 * (6 - i)) for i in range(1, 6)]
        asks = [(round(ltp + 0.05 * i, 2), 1000 * (6 - i)) for i in range(1, 6)]
        return DepthSnapshot(bids=bids, asks=asks, timestamp=datetime.now())

    async def get_instrument_list(self) -> list[Instrument]:
        """Return instrument universe from nifty_universe.py."""
        if self._instruments is None:
            stocks = get_universe(include_nifty500=False)
            self._instruments = [
                Instrument(symbol=s.symbol, name=s.name, sector=s.sector)
                for s in stocks
            ]
        return self._instruments

    async def get_nifty_value(self) -> float:
        """Get current Nifty 50 value."""
        def _fetch():
            ticker = yf.Ticker("^NSEI")
            info = ticker.fast_info
            return info.get("lastPrice", 0.0) or info.get("previousClose", 0.0)

        try:
            return await _run_with_backoff(_fetch)
        except Exception:
            logger.error("Failed to fetch Nifty value")
            return 0.0

    async def get_vix(self) -> float:
        """Get India VIX value."""
        def _fetch():
            ticker = yf.Ticker("^INDIAVIX")
            info = ticker.fast_info
            return info.get("lastPrice", 0.0) or info.get("previousClose", 14.0)

        try:
            return await _run_with_backoff(_fetch)
        except Exception:
            logger.warning("Failed to fetch VIX, defaulting to 14.0")
            return 14.0

    async def get_bulk_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Batch LTP fetch — uses yf.download() for efficiency."""
        if not symbols:
            return {}

        def _fetch_batch():
            yf_symbols = [_nse_symbol(s) for s in symbols]
            results = {}
            try:
                data = yf.download(
                    yf_symbols, period="1d", interval="1d",
                    progress=False, threads=True, group_by="ticker",
                )
                if data.empty:
                    return results
                for sym, yf_sym in zip(symbols, yf_symbols):
                    try:
                        if len(yf_symbols) > 1:
                            if yf_sym in data.columns.get_level_values(0):
                                val = data[yf_sym]["Close"].dropna().iloc[-1]
                                results[sym] = float(val)
                        else:
                            val = data["Close"].dropna().iloc[-1]
                            results[sym] = float(val)
                    except (KeyError, IndexError):
                        pass
            except Exception as e:
                logger.warning("Batch download failed: %s", str(e)[:80])
            return results

        try:
            results = await _run_with_backoff(_fetch_batch)
            now = datetime.now()
            for sym, price in results.items():
                self._ltp_cache[sym] = (price, now)
            return results
        except Exception:
            # Return whatever's in cache
            return {s: self._ltp_cache[s][0] for s in symbols if s in self._ltp_cache}
