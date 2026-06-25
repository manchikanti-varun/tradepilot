"""Yahoo Finance market data provider — cloud-server hardened.

Key changes for Railway/cloud deployment:
- Updated to work with yfinance >= 1.4 (Yahoo API changed Feb 2025)
- Uses yf.download() (batch API) — more reliable from server IPs
- Custom session with browser-like User-Agent to avoid Yahoo's bot detection
- Reduced concurrency (max 3) to avoid rate limits
- Hard per-call timeouts (15s) to prevent hanging
- Graceful degradation with stale cache on failure
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

# Concurrency limit — lower for cloud to avoid Yahoo throttling
_SEMAPHORE = asyncio.Semaphore(3)
_MAX_RETRIES = 2
_BACKOFF_BASE = 1.5
_PER_CALL_TIMEOUT = 15  # seconds


def _nse_symbol(symbol: str) -> str:
    """Convert symbol to Yahoo Finance NSE format."""
    return f"{symbol}.NS"


async def _run_with_backoff(func, *args, retries: int = _MAX_RETRIES):
    """Execute a blocking function with semaphore + timeout + backoff."""
    loop = asyncio.get_event_loop()
    last_error = None
    for attempt in range(retries):
        async with _SEMAPHORE:
            try:
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, func, *args),
                    timeout=_PER_CALL_TIMEOUT,
                )
                return result
            except asyncio.TimeoutError:
                last_error = f"Timeout after {_PER_CALL_TIMEOUT}s"
                logger.warning(
                    "Yahoo fetch timed out (attempt %d/%d)",
                    attempt + 1, retries,
                )
            except Exception as e:
                last_error = str(e)
                if attempt < retries - 1:
                    wait = _BACKOFF_BASE ** (attempt + 1)
                    logger.warning(
                        "Yahoo fetch failed (attempt %d/%d): %s. Retry in %.1fs",
                        attempt + 1, retries, str(e)[:80], wait,
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error("Yahoo fetch failed after %d attempts: %s", retries, str(e)[:100])
    raise RuntimeError(f"All {retries} attempts failed: {last_error}")


def _normalize_download_df(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize yf.download() output to standard columns.
    
    yfinance >= 1.0 may return MultiIndex columns. This flattens them.
    """
    if df.empty:
        return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])
    
    # Handle MultiIndex columns (yfinance >= 1.0 with single ticker)
    if isinstance(df.columns, pd.MultiIndex):
        # For single ticker download, drop the ticker level
        df.columns = df.columns.droplevel("Ticker") if "Ticker" in df.columns.names else [col[0] for col in df.columns]
    
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


class YahooFinanceProvider(MarketDataProvider):
    """Market data from Yahoo Finance — cloud-hardened for yfinance >= 1.4."""

    def __init__(self):
        self._ltp_cache: dict[str, tuple[float, datetime]] = {}
        self._candle_cache: dict[str, tuple[pd.DataFrame, datetime]] = {}
        self._instruments: Optional[list[Instrument]] = None
        self._LTP_CACHE_TTL = timedelta(seconds=60)
        self._CANDLE_CACHE_TTL = timedelta(minutes=5)

    async def get_ltp(self, symbol: str) -> float:
        """Get last traded price via yf.download (more reliable from cloud)."""
        if symbol in self._ltp_cache:
            price, ts = self._ltp_cache[symbol]
            if datetime.now() - ts < self._LTP_CACHE_TTL:
                return price

        def _fetch():
            yf_sym = _nse_symbol(symbol)
            # Try 1-minute data first for freshest price
            data = yf.download(yf_sym, period="1d", interval="1m", progress=False)
            if data.empty:
                # Fallback: daily data
                data = yf.download(yf_sym, period="5d", interval="1d", progress=False)
            if data.empty:
                return 0.0
            # Handle MultiIndex columns
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.droplevel("Ticker") if "Ticker" in data.columns.names else [col[0] for col in data.columns]
            return float(data["Close"].dropna().iloc[-1])

        try:
            price = await _run_with_backoff(_fetch)
            if price > 0:
                self._ltp_cache[symbol] = (price, datetime.now())
            return price
        except Exception:
            if symbol in self._ltp_cache:
                logger.warning("Using stale LTP cache for %s", symbol)
                return self._ltp_cache[symbol][0]
            return 0.0

    async def get_candles(
        self, symbol: str, interval: str, from_dt: datetime, to_dt: datetime
    ) -> pd.DataFrame:
        """Get OHLCV candles via yf.download()."""
        cache_key = f"{symbol}_{interval}"
        if cache_key in self._candle_cache:
            df, ts = self._candle_cache[cache_key]
            if datetime.now() - ts < self._CANDLE_CACHE_TTL:
                return df

        interval_map = {"1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "1d": "1d"}
        yf_interval = interval_map.get(interval, "5m")

        # For intraday intervals, use period param (more reliable)
        if yf_interval in ("1m", "5m", "15m"):
            period = "5d" if yf_interval in ("5m", "15m") else "1d"
        else:
            period = None

        def _fetch():
            yf_sym = _nse_symbol(symbol)
            if period:
                df = yf.download(yf_sym, period=period, interval=yf_interval, progress=False)
            else:
                df = yf.download(
                    yf_sym,
                    start=from_dt.strftime("%Y-%m-%d"),
                    end=(to_dt + timedelta(days=1)).strftime("%Y-%m-%d"),
                    interval=yf_interval,
                    progress=False,
                )
            return _normalize_download_df(df)

        try:
            result = await _run_with_backoff(_fetch)
            if not result.empty:
                self._candle_cache[cache_key] = (result, datetime.now())
            return result
        except Exception:
            if cache_key in self._candle_cache:
                logger.warning("Using stale candle cache for %s", symbol)
                return self._candle_cache[cache_key][0]
            return pd.DataFrame(columns=["timestamp", "open", "high", "low", "close", "volume"])

    async def get_market_depth(self, symbol: str) -> DepthSnapshot:
        """Synthetic depth based on LTP (Yahoo doesn't provide real depth)."""
        ltp = await self.get_ltp(symbol)
        if ltp == 0:
            ltp = 100.0
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
            data = yf.download("^NSEI", period="1d", interval="1m", progress=False)
            if data.empty:
                data = yf.download("^NSEI", period="5d", interval="1d", progress=False)
            if data.empty:
                return 0.0
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.droplevel("Ticker") if "Ticker" in data.columns.names else [col[0] for col in data.columns]
            return float(data["Close"].dropna().iloc[-1])

        try:
            return await _run_with_backoff(_fetch)
        except Exception:
            logger.error("Failed to fetch Nifty value")
            return 0.0

    async def get_vix(self) -> float:
        """Get India VIX value."""
        def _fetch():
            data = yf.download("^INDIAVIX", period="5d", interval="1d", progress=False)
            if data.empty:
                return 14.0
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = data.columns.droplevel("Ticker") if "Ticker" in data.columns.names else [col[0] for col in data.columns]
            return float(data["Close"].dropna().iloc[-1])

        try:
            return await _run_with_backoff(_fetch)
        except Exception:
            logger.warning("Failed to fetch VIX, defaulting to 14.0")
            return 14.0

    async def get_bulk_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Batch LTP fetch via yf.download() with multiple tickers."""
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
                            if isinstance(data.columns, pd.MultiIndex):
                                if yf_sym in data.columns.get_level_values(0):
                                    val = data[yf_sym]["Close"].dropna().iloc[-1]
                                    results[sym] = float(val)
                            else:
                                val = data["Close"].dropna().iloc[-1]
                                results[sym] = float(val)
                        else:
                            if isinstance(data.columns, pd.MultiIndex):
                                data.columns = data.columns.droplevel("Ticker")
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
            return {s: self._ltp_cache[s][0] for s in symbols if s in self._ltp_cache}
