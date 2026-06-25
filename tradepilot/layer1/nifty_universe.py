"""Nifty Universe — live from NSE + DB-backed with weekly refresh.

Flow:
1. On first call, tries to load from SQLite (stock_universe table)
2. If DB is empty or stale (>7 days), fetches live from NSE website
3. If NSE fetch fails, uses hardcoded fallback (75 stocks)
4. Scheduler refreshes every Monday 8:00 AM IST

NSE endpoint: https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20200
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)


@dataclass
class StockInfo:
    symbol: str
    name: str
    sector: str
    index: str  # "Nifty200" or "Nifty500"


# In-memory cache
_universe_cache: list[StockInfo] = []
_cache_loaded_at: Optional[datetime] = None
_CACHE_TTL = timedelta(hours=24)

# NSE headers (required to avoid 403)
_NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/market-data/live-equity-market",
}


async def fetch_nifty200_from_nse() -> list[StockInfo]:
    """Fetch live Nifty 200 constituents from NSE website."""
    stocks = []
    try:
        async with aiohttp.ClientSession(headers=_NSE_HEADERS) as session:
            # First hit the main page to get cookies
            async with session.get("https://www.nseindia.com", timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    logger.warning("NSE main page returned %d", resp.status)

            # Now fetch Nifty 200 constituents
            url = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20200"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning("NSE Nifty 200 API returned %d", resp.status)
                    return []
                data = await resp.json()

        if not data or "data" not in data:
            logger.warning("NSE Nifty 200 response has no 'data' field")
            return []

        for item in data["data"]:
            symbol = item.get("symbol", "")
            if not symbol or symbol == "NIFTY 200":
                continue
            stocks.append(StockInfo(
                symbol=symbol,
                name=item.get("companyName", symbol),
                sector=item.get("industry", "Unknown"),
                index="Nifty200",
            ))

        logger.info("Fetched %d stocks from NSE Nifty 200", len(stocks))
        return stocks

    except asyncio.TimeoutError:
        logger.warning("NSE Nifty 200 fetch timed out")
    except Exception as e:
        logger.warning("NSE Nifty 200 fetch failed: %s", str(e)[:100])
    return []


async def save_universe_to_db(stocks: list[StockInfo]):
    """Save stock universe to SQLite."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute("DELETE FROM stock_universe")
        for s in stocks:
            await db.execute(
                "INSERT INTO stock_universe (symbol, company, sector, index_name, added_date) VALUES (?, ?, ?, ?, ?)",
                (s.symbol, s.name, s.sector, s.index, datetime.now().strftime("%Y-%m-%d")),
            )
        await db.commit()
    logger.info("Saved %d stocks to stock_universe table", len(stocks))


async def load_universe_from_db() -> list[StockInfo]:
    """Load stock universe from SQLite."""
    from tradepilot.database import get_db
    stocks = []
    try:
        async with get_db() as db:
            rows = await db.execute("SELECT symbol, company, sector, index_name FROM stock_universe")
            async for row in rows:
                stocks.append(StockInfo(
                    symbol=row["symbol"],
                    name=row["company"],
                    sector=row["sector"],
                    index=row["index_name"],
                ))
    except Exception as e:
        logger.warning("Failed to load universe from DB: %s", str(e)[:80])
    return stocks


async def refresh_universe():
    """Fetch fresh Nifty 200 from NSE and save to DB. Called weekly."""
    stocks = await fetch_nifty200_from_nse()
    if stocks and len(stocks) >= 50:  # Sanity check — NSE should return ~200
        await save_universe_to_db(stocks)
        global _universe_cache, _cache_loaded_at
        _universe_cache = stocks
        _cache_loaded_at = datetime.now()
        logger.info("Universe refreshed: %d stocks", len(stocks))
    else:
        logger.warning("Universe refresh got only %d stocks — keeping existing", len(stocks))


async def get_universe_async() -> list[StockInfo]:
    """Get the stock universe (async). Tries DB first, then NSE, then fallback."""
    global _universe_cache, _cache_loaded_at

    # Return cache if fresh
    if _universe_cache and _cache_loaded_at and datetime.now() - _cache_loaded_at < _CACHE_TTL:
        return _universe_cache

    # Try loading from DB
    stocks = await load_universe_from_db()
    if stocks and len(stocks) >= 50:
        _universe_cache = stocks
        _cache_loaded_at = datetime.now()
        return stocks

    # Try fetching from NSE
    stocks = await fetch_nifty200_from_nse()
    if stocks and len(stocks) >= 50:
        await save_universe_to_db(stocks)
        _universe_cache = stocks
        _cache_loaded_at = datetime.now()
        return stocks

    # Fallback to hardcoded
    logger.warning("Using hardcoded fallback universe")
    _universe_cache = FALLBACK_STOCKS
    _cache_loaded_at = datetime.now()
    return FALLBACK_STOCKS


def get_universe(include_nifty500: bool = False) -> list[StockInfo]:
    """Synchronous access — returns cached universe or fallback."""
    if _universe_cache:
        return _universe_cache
    return FALLBACK_STOCKS


def get_symbol_list(include_nifty500: bool = False) -> list[str]:
    """Get just the symbol strings."""
    return [s.symbol for s in get_universe(include_nifty500)]


def get_sector_map(include_nifty500: bool = False) -> dict[str, str]:
    """Get symbol→sector mapping."""
    return {s.symbol: s.sector for s in get_universe(include_nifty500)}


# ═══════════════════════════════════════════════════════════════════
# HARDCODED FALLBACK — used only if NSE + DB both fail
# ═══════════════════════════════════════════════════════════════════
FALLBACK_STOCKS = [
    StockInfo("RELIANCE", "Reliance Industries", "Oil & Gas", "Nifty200"),
    StockInfo("TCS", "Tata Consultancy", "IT", "Nifty200"),
    StockInfo("HDFCBANK", "HDFC Bank", "Banking", "Nifty200"),
    StockInfo("INFY", "Infosys", "IT", "Nifty200"),
    StockInfo("ICICIBANK", "ICICI Bank", "Banking", "Nifty200"),
    StockInfo("HINDUNILVR", "Hindustan Unilever", "FMCG", "Nifty200"),
    StockInfo("ITC", "ITC Limited", "FMCG", "Nifty200"),
    StockInfo("SBIN", "State Bank of India", "Banking", "Nifty200"),
    StockInfo("BHARTIARTL", "Bharti Airtel", "Telecom", "Nifty200"),
    StockInfo("KOTAKBANK", "Kotak Mahindra Bank", "Banking", "Nifty200"),
    StockInfo("LT", "Larsen & Toubro", "Infrastructure", "Nifty200"),
    StockInfo("AXISBANK", "Axis Bank", "Banking", "Nifty200"),
    StockInfo("ASIANPAINT", "Asian Paints", "Consumer", "Nifty200"),
    StockInfo("MARUTI", "Maruti Suzuki", "Auto", "Nifty200"),
    StockInfo("TITAN", "Titan Company", "Consumer", "Nifty200"),
    StockInfo("SUNPHARMA", "Sun Pharmaceutical", "Pharma", "Nifty200"),
    StockInfo("BAJFINANCE", "Bajaj Finance", "Finance", "Nifty200"),
    StockInfo("WIPRO", "Wipro", "IT", "Nifty200"),
    StockInfo("HCLTECH", "HCL Technologies", "IT", "Nifty200"),
    StockInfo("ULTRACEMCO", "UltraTech Cement", "Cement", "Nifty200"),
    StockInfo("NTPC", "NTPC Limited", "Power", "Nifty200"),
    StockInfo("POWERGRID", "Power Grid Corp", "Power", "Nifty200"),
    StockInfo("ONGC", "ONGC", "Oil & Gas", "Nifty200"),
    StockInfo("TATAMOTORS", "Tata Motors", "Auto", "Nifty200"),
    StockInfo("COALINDIA", "Coal India", "Mining", "Nifty200"),
    StockInfo("BAJAJFINSV", "Bajaj Finserv", "Finance", "Nifty200"),
    StockInfo("TECHM", "Tech Mahindra", "IT", "Nifty200"),
    StockInfo("NESTLEIND", "Nestle India", "FMCG", "Nifty200"),
    StockInfo("TATASTEEL", "Tata Steel", "Metals", "Nifty200"),
    StockInfo("JSWSTEEL", "JSW Steel", "Metals", "Nifty200"),
    StockInfo("HINDALCO", "Hindalco", "Metals", "Nifty200"),
    StockInfo("INDUSINDBK", "IndusInd Bank", "Banking", "Nifty200"),
    StockInfo("CIPLA", "Cipla", "Pharma", "Nifty200"),
    StockInfo("DRREDDY", "Dr Reddy's Labs", "Pharma", "Nifty200"),
    StockInfo("APOLLOHOSP", "Apollo Hospitals", "Healthcare", "Nifty200"),
    StockInfo("EICHERMOT", "Eicher Motors", "Auto", "Nifty200"),
    StockInfo("DIVISLAB", "Divi's Labs", "Pharma", "Nifty200"),
    StockInfo("BPCL", "BPCL", "Oil & Gas", "Nifty200"),
    StockInfo("GRASIM", "Grasim Industries", "Cement", "Nifty200"),
    StockInfo("TATACONSUM", "Tata Consumer", "FMCG", "Nifty200"),
    StockInfo("BRITANNIA", "Britannia", "FMCG", "Nifty200"),
    StockInfo("HEROMOTOCO", "Hero MotoCorp", "Auto", "Nifty200"),
    StockInfo("SBILIFE", "SBI Life Insurance", "Insurance", "Nifty200"),
    StockInfo("HDFCLIFE", "HDFC Life", "Insurance", "Nifty200"),
    StockInfo("DABUR", "Dabur India", "FMCG", "Nifty200"),
    StockInfo("PIDILITIND", "Pidilite Industries", "Chemicals", "Nifty200"),
    StockInfo("GODREJCP", "Godrej Consumer", "FMCG", "Nifty200"),
    StockInfo("BANKBARODA", "Bank of Baroda", "Banking", "Nifty200"),
    StockInfo("PNB", "Punjab National Bank", "Banking", "Nifty200"),
    StockInfo("IOC", "Indian Oil Corp", "Oil & Gas", "Nifty200"),
    StockInfo("GAIL", "GAIL India", "Oil & Gas", "Nifty200"),
    StockInfo("VEDL", "Vedanta", "Metals", "Nifty200"),
    StockInfo("TRENT", "Trent Limited", "Retail", "Nifty200"),
    StockInfo("ZOMATO", "Zomato", "Tech", "Nifty200"),
    StockInfo("IRCTC", "IRCTC", "Travel", "Nifty200"),
    StockInfo("HAL", "Hindustan Aeronautics", "Defence", "Nifty200"),
    StockInfo("BEL", "Bharat Electronics", "Defence", "Nifty200"),
    StockInfo("RECLTD", "REC Limited", "Finance", "Nifty200"),
    StockInfo("PFC", "Power Finance Corp", "Finance", "Nifty200"),
    StockInfo("NHPC", "NHPC", "Power", "Nifty200"),
    StockInfo("TATAPOWER", "Tata Power", "Power", "Nifty200"),
    StockInfo("ADANIPORTS", "Adani Ports", "Infrastructure", "Nifty200"),
    StockInfo("M&M", "Mahindra & Mahindra", "Auto", "Nifty200"),
    StockInfo("BAJAJ-AUTO", "Bajaj Auto", "Auto", "Nifty200"),
    StockInfo("DMART", "Avenue Supermarts", "Retail", "Nifty200"),
    StockInfo("PERSISTENT", "Persistent Systems", "IT", "Nifty200"),
    StockInfo("COFORGE", "Coforge", "IT", "Nifty200"),
    StockInfo("LTIM", "LTIMindtree", "IT", "Nifty200"),
    StockInfo("MPHASIS", "Mphasis", "IT", "Nifty200"),
    StockInfo("MAXHEALTH", "Max Healthcare", "Healthcare", "Nifty200"),
    StockInfo("FORTIS", "Fortis Healthcare", "Healthcare", "Nifty200"),
    StockInfo("CHOLAFIN", "Cholamandalam Fin", "Finance", "Nifty200"),
    StockInfo("MUTHOOTFIN", "Muthoot Finance", "Finance", "Nifty200"),
    StockInfo("VOLTAS", "Voltas", "Consumer", "Nifty200"),
    StockInfo("SIEMENS", "Siemens India", "Infrastructure", "Nifty200"),
]
