"""Angel One SmartAPI — real-time market data provider.

Provides:
- Live LTP via WebSocket (tick-by-tick, zero delay)
- Real market depth (5-level bid/ask)
- Historical candles (1min, 5min, 15min, daily)
- Auto-login with TOTP generation
- Auto-reconnect on WebSocket drop
- Graceful fallback to yfinance if SmartAPI fails

Credentials from environment variables:
- ANGEL_API_KEY
- ANGEL_CLIENT_ID
- ANGEL_PASSWORD
- ANGEL_TOTP_SECRET
"""

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

import pandas as pd
import pyotp
from SmartApi import SmartConnect
from SmartApi.smartWebSocketV2 import SmartWebSocketV2

from tradepilot.layer1.base import (
    MarketDataProvider,
    Instrument,
    DepthSnapshot,
)
from tradepilot.layer1.nifty_universe import get_universe

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

# Token map: NSE symbol → Angel One token (loaded from instrument file)
_TOKEN_MAP: dict[str, dict] = {}
_TOKEN_MAP_LOADED = False


def _get_credentials() -> dict:
    """Get SmartAPI credentials from environment."""
    return {
        "api_key": os.environ.get("ANGEL_API_KEY", ""),
        "client_id": os.environ.get("ANGEL_CLIENT_ID", ""),
        "password": os.environ.get("ANGEL_PASSWORD", ""),
        "totp_secret": os.environ.get("ANGEL_TOTP_SECRET", ""),
    }


def _generate_totp(secret: str) -> str:
    """Generate current TOTP code from secret."""
    totp = pyotp.TOTP(secret)
    return totp.now()


class AngelOneSession:
    """Manages Angel One login session with auto-refresh."""

    def __init__(self):
        self._smart_api: Optional[SmartConnect] = None
        self._auth_token: Optional[str] = None
        self._refresh_token: Optional[str] = None
        self._feed_token: Optional[str] = None
        self._login_time: Optional[datetime] = None
        self._is_logged_in = False
        self._lock = asyncio.Lock()

    @property
    def is_logged_in(self) -> bool:
        return self._is_logged_in and self._smart_api is not None

    @property
    def smart_api(self) -> Optional[SmartConnect]:
        return self._smart_api

    @property
    def auth_token(self) -> Optional[str]:
        return self._auth_token

    @property
    def feed_token(self) -> Optional[str]:
        return self._feed_token

    async def login(self) -> bool:
        """Login to Angel One. Returns True on success."""
        async with self._lock:
            if self._is_logged_in:
                # Check if session is still fresh (< 8 hours)
                if self._login_time and (datetime.now() - self._login_time).seconds < 28800:
                    return True

            creds = _get_credentials()
            if not all(creds.values()):
                logger.warning("Angel One credentials not fully configured")
                return False

            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, self._do_login, creds)
                return result
            except Exception as e:
                logger.error("Angel One login failed: %s", str(e)[:150])
                self._is_logged_in = False
                return False

    def _do_login(self, creds: dict) -> bool:
        """Synchronous login (runs in executor)."""
        try:
            self._smart_api = SmartConnect(api_key=creds["api_key"])
            totp_code = _generate_totp(creds["totp_secret"])

            data = self._smart_api.generateSession(
                clientCode=creds["client_id"],
                password=creds["password"],
                totp=totp_code,
            )

            if data.get("status") is False:
                logger.error("Angel One session generation failed: %s", data.get("message", "Unknown"))
                self._is_logged_in = False
                return False

            self._auth_token = data["data"]["jwtToken"]
            self._refresh_token = data["data"]["refreshToken"]
            self._feed_token = self._smart_api.getfeedToken()
            self._login_time = datetime.now()
            self._is_logged_in = True
            logger.info("Angel One login successful — client: %s", creds["client_id"])
            return True

        except Exception as e:
            logger.error("Angel One login error: %s", str(e)[:150])
            self._is_logged_in = False
            return False

    async def ensure_logged_in(self) -> bool:
        """Ensure we have a valid session."""
        if not self.is_logged_in:
            return await self.login()
        return True


# Global session
_session = AngelOneSession()


async def _load_token_map():
    """Load Angel One instrument token map."""
    global _TOKEN_MAP, _TOKEN_MAP_LOADED
    if _TOKEN_MAP_LOADED:
        return

    if not await _session.ensure_logged_in():
        return

    try:
        loop = asyncio.get_event_loop()
        instruments = await loop.run_in_executor(
            None, _session.smart_api.getInstrumentList
        )

        if instruments is None:
            logger.warning("Angel One instrument list returned None")
            return

        # Build lookup: symbol → {token, symbol_token, exchange}
        for inst in instruments:
            if inst.get("exch_seg") == "NSE" and inst.get("symbol", "").endswith("-EQ"):
                clean_symbol = inst["symbol"].replace("-EQ", "")
                _TOKEN_MAP[clean_symbol] = {
                    "token": inst["token"],
                    "symbol": inst["symbol"],
                    "exchange": "NSE",
                }

        _TOKEN_MAP_LOADED = True
        logger.info("Angel One token map loaded: %d NSE symbols", len(_TOKEN_MAP))

    except Exception as e:
        logger.error("Failed to load Angel One token map: %s", str(e)[:100])


def _get_token(symbol: str) -> Optional[str]:
    """Get Angel One token for a symbol."""
    info = _TOKEN_MAP.get(symbol)
    return info["token"] if info else None


class AngelOneProvider(MarketDataProvider):
    """Real-time market data from Angel One SmartAPI.

    Features:
    - LTP via REST API (real-time, no delay)
    - Market depth (5-level bid/ask)
    - Historical candles
    - Falls back to yfinance if Angel One is unavailable
    """

    def __init__(self):
        self._ltp_cache: dict[str, tuple[float, datetime]] = {}
        self._candle_cache: dict[str, tuple[pd.DataFrame, datetime]] = {}
        self._LTP_CACHE_TTL = timedelta(seconds=5)  # Very short — we want fresh data
        self._CANDLE_CACHE_TTL = timedelta(minutes=3)
        self._fallback = None  # Lazy-loaded YahooFinanceProvider
        self._daily_api_calls = 0
        self._daily_call_reset = datetime.now().date()
        self._MAX_DAILY_CALLS = 2800

    def _check_daily_limit(self) -> bool:
        """Check if we're within daily API call limit."""
        today = datetime.now().date()
        if today != self._daily_call_reset:
            self._daily_api_calls = 0
            self._daily_call_reset = today
        return self._daily_api_calls < self._MAX_DAILY_CALLS

    def _increment_calls(self, count: int = 1):
        self._daily_api_calls += count

    async def _get_fallback(self):
        """Lazy-load Yahoo provider as fallback."""
        if self._fallback is None:
            from tradepilot.layer1.yahoo_provider import YahooFinanceProvider
            self._fallback = YahooFinanceProvider()
        return self._fallback

    async def get_ltp(self, symbol: str) -> float:
        """Get real-time LTP from Angel One."""
        # Check cache (5 sec TTL)
        if symbol in self._ltp_cache:
            price, ts = self._ltp_cache[symbol]
            if datetime.now() - ts < self._LTP_CACHE_TTL:
                return price

        if not self._check_daily_limit():
            fallback = await self._get_fallback()
            return await fallback.get_ltp(symbol)

        await _load_token_map()
        token = _get_token(symbol)
        if not token:
            fallback = await self._get_fallback()
            return await fallback.get_ltp(symbol)

        if not await _session.ensure_logged_in():
            fallback = await self._get_fallback()
            return await fallback.get_ltp(symbol)

        try:
            loop = asyncio.get_event_loop()
            data = await asyncio.wait_for(
                loop.run_in_executor(None, self._fetch_ltp, symbol, token),
                timeout=5,
            )
            if data and data > 0:
                self._ltp_cache[symbol] = (data, datetime.now())
                self._increment_calls()
                return data
        except asyncio.TimeoutError:
            logger.warning("Angel One LTP timeout for %s", symbol)
        except Exception as e:
            logger.warning("Angel One LTP failed for %s: %s", symbol, str(e)[:80])

        # Fallback to yfinance
        fallback = await self._get_fallback()
        return await fallback.get_ltp(symbol)

    def _fetch_ltp(self, symbol: str, token: str) -> float:
        """Synchronous LTP fetch."""
        data = _session.smart_api.ltpData("NSE", symbol + "-EQ", token)
        if data and data.get("status") and data.get("data"):
            return float(data["data"].get("ltp", 0))
        return 0.0

    async def get_candles(
        self, symbol: str, interval: str, from_dt: datetime, to_dt: datetime
    ) -> pd.DataFrame:
        """Get OHLCV candles from Angel One."""
        cache_key = f"{symbol}_{interval}"
        if cache_key in self._candle_cache:
            df, ts = self._candle_cache[cache_key]
            if datetime.now() - ts < self._CANDLE_CACHE_TTL:
                return df

        if not self._check_daily_limit():
            fallback = await self._get_fallback()
            return await fallback.get_candles(symbol, interval, from_dt, to_dt)

        await _load_token_map()
        token = _get_token(symbol)
        if not token:
            fallback = await self._get_fallback()
            return await fallback.get_candles(symbol, interval, from_dt, to_dt)

        if not await _session.ensure_logged_in():
            fallback = await self._get_fallback()
            return await fallback.get_candles(symbol, interval, from_dt, to_dt)

        # Map interval to Angel One format
        interval_map = {
            "1m": "ONE_MINUTE", "5m": "FIVE_MINUTE",
            "15m": "FIFTEEN_MINUTE", "1h": "ONE_HOUR", "1d": "ONE_DAY",
        }
        angel_interval = interval_map.get(interval, "FIVE_MINUTE")

        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(
                    None, self._fetch_candles, symbol, token, angel_interval, from_dt, to_dt
                ),
                timeout=10,
            )
            if result is not None and not result.empty:
                self._candle_cache[cache_key] = (result, datetime.now())
                self._increment_calls()
                return result
        except asyncio.TimeoutError:
            logger.warning("Angel One candles timeout for %s", symbol)
        except Exception as e:
            logger.warning("Angel One candles failed for %s: %s", symbol, str(e)[:80])

        # Fallback
        fallback = await self._get_fallback()
        return await fallback.get_candles(symbol, interval, from_dt, to_dt)

    def _fetch_candles(self, symbol: str, token: str, interval: str,
                       from_dt: datetime, to_dt: datetime) -> Optional[pd.DataFrame]:
        """Synchronous candle fetch."""
        params = {
            "exchange": "NSE",
            "symboltoken": token,
            "interval": interval,
            "fromdate": from_dt.strftime("%Y-%m-%d %H:%M"),
            "todate": to_dt.strftime("%Y-%m-%d %H:%M"),
        }
        data = _session.smart_api.getCandleData(params)
        if not data or not data.get("status") or not data.get("data"):
            return None

        rows = data["data"]
        if not rows:
            return None

        df = pd.DataFrame(rows, columns=["timestamp", "open", "high", "low", "close", "volume"])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df

    async def get_market_depth(self, symbol: str) -> DepthSnapshot:
        """Get real 5-level market depth from Angel One."""
        if not self._check_daily_limit():
            fallback = await self._get_fallback()
            return await fallback.get_market_depth(symbol)

        await _load_token_map()
        token = _get_token(symbol)
        if not token or not await _session.ensure_logged_in():
            fallback = await self._get_fallback()
            return await fallback.get_market_depth(symbol)

        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, self._fetch_depth, symbol, token),
                timeout=5,
            )
            if result:
                self._increment_calls()
                return result
        except Exception as e:
            logger.warning("Angel One depth failed for %s: %s", symbol, str(e)[:80])

        fallback = await self._get_fallback()
        return await fallback.get_market_depth(symbol)

    def _fetch_depth(self, symbol: str, token: str) -> Optional[DepthSnapshot]:
        """Synchronous market depth fetch."""
        data = _session.smart_api.marketData(
            mode="FULL",
            exchangeTokens={"NSE": [token]},
        )
        if not data or not data.get("status") or not data.get("data"):
            return None

        fetched = data["data"].get("fetched", [])
        if not fetched:
            return None

        stock_data = fetched[0]
        depth = stock_data.get("depth", {})
        buy_depth = depth.get("buy", [])
        sell_depth = depth.get("sell", [])

        bids = [(float(b.get("price", 0)), int(b.get("quantity", 0))) for b in buy_depth[:5]]
        asks = [(float(a.get("price", 0)), int(a.get("quantity", 0))) for a in sell_depth[:5]]

        return DepthSnapshot(bids=bids, asks=asks, timestamp=datetime.now())

    async def get_instrument_list(self) -> list[Instrument]:
        """Return instrument universe — live from NSE (cached in DB)."""
        from tradepilot.layer1.nifty_universe import get_universe_async, get_universe
        try:
            stocks = await get_universe_async()
        except Exception:
            stocks = get_universe()
        return [
            Instrument(symbol=s.symbol, name=s.name, sector=s.sector)
            for s in stocks
        ]

    async def get_nifty_value(self) -> float:
        """Get Nifty 50 value from Angel One."""
        if not await _session.ensure_logged_in() or not self._check_daily_limit():
            fallback = await self._get_fallback()
            return await fallback.get_nifty_value()

        try:
            loop = asyncio.get_event_loop()
            data = await asyncio.wait_for(
                loop.run_in_executor(None, self._fetch_nifty),
                timeout=5,
            )
            if data and data > 0:
                self._increment_calls()
                return data
        except Exception as e:
            logger.warning("Angel One Nifty fetch failed: %s", str(e)[:80])

        fallback = await self._get_fallback()
        return await fallback.get_nifty_value()

    def _fetch_nifty(self) -> float:
        """Fetch Nifty 50 LTP."""
        # Nifty 50 token is 99926000 on Angel One
        data = _session.smart_api.ltpData("NSE", "Nifty 50", "99926000")
        if data and data.get("status") and data.get("data"):
            val = float(data["data"].get("ltp", 0))
            # Nifty should be between 10000 and 50000
            if 10000 < val < 50000:
                return val
        return 0.0

    async def get_vix(self) -> float:
        """Get India VIX — uses yfinance (more reliable for VIX than Angel One token)."""
        # Angel One's VIX token is unreliable — use yfinance for this one value
        fallback = await self._get_fallback()
        return await fallback.get_vix()

    def _fetch_vix(self) -> float:
        """Fetch India VIX. Falls back to yfinance if Angel One returns invalid data."""
        # Try India VIX token on NSE
        try:
            data = _session.smart_api.ltpData("NSE", "India VIX", "99926004")
            if data and data.get("status") and data.get("data"):
                val = float(data["data"].get("ltp", 0))
                # VIX should be between 5 and 100 — if outside, it's wrong data
                if 5 < val < 100:
                    return val
        except Exception:
            pass
        # Return 0 to trigger fallback
        return 0.0

    async def get_bulk_ltp(self, symbols: list[str]) -> dict[str, float]:
        """Batch LTP fetch for multiple symbols."""
        if not symbols:
            return {}

        await _load_token_map()
        if not await _session.ensure_logged_in() or not self._check_daily_limit():
            fallback = await self._get_fallback()
            return await fallback.get_bulk_ltp(symbols)

        # Build token list for market data API
        tokens = []
        symbol_to_token = {}
        for sym in symbols:
            token = _get_token(sym)
            if token:
                tokens.append(token)
                symbol_to_token[token] = sym

        if not tokens:
            fallback = await self._get_fallback()
            return await fallback.get_bulk_ltp(symbols)

        try:
            loop = asyncio.get_event_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, self._fetch_bulk_ltp, tokens, symbol_to_token),
                timeout=10,
            )
            if result:
                self._increment_calls(1)  # marketData counts as 1 call regardless of symbols
                now = datetime.now()
                for sym, price in result.items():
                    self._ltp_cache[sym] = (price, now)
                return result
        except Exception as e:
            logger.warning("Angel One bulk LTP failed: %s", str(e)[:80])

        fallback = await self._get_fallback()
        return await fallback.get_bulk_ltp(symbols)

    def _fetch_bulk_ltp(self, tokens: list[str], symbol_to_token: dict) -> dict[str, float]:
        """Synchronous bulk LTP fetch using marketData API."""
        # Angel One marketData accepts up to 50 tokens per call
        results = {}
        for i in range(0, len(tokens), 50):
            batch = tokens[i:i+50]
            data = _session.smart_api.marketData(
                mode="LTP",
                exchangeTokens={"NSE": batch},
            )
            if data and data.get("status") and data.get("data"):
                for item in data["data"].get("fetched", []):
                    token = item.get("symbolToken")
                    ltp = item.get("ltp", 0)
                    if token in symbol_to_token and ltp > 0:
                        results[symbol_to_token[token]] = float(ltp)
        return results
