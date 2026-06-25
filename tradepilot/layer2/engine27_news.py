"""Engine 27: Market News — fetches and summarizes Indian market news.

Sources (free, no API key):
- Moneycontrol RSS (top stories, market news)
- Economic Times Markets RSS
- Livemint Markets RSS
- NDTV Profit RSS
- Business Standard Markets RSS
- Zerodha Varsity Blog
- NSE India Twitter/X (via RSS bridge)
- TradingView Ideas (India)

Output:
- Simple plain-English summaries for the dashboard
- Sentiment score (0-100) per headline for Engine 4 scoring
- Market mood indicator (BULLISH / BEARISH / NEUTRAL)
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional

import aiohttp
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# RSS feed URLs (free, no auth)
NEWS_FEEDS = [
    # === MAINSTREAM MARKET NEWS ===
    {
        "name": "Moneycontrol Markets",
        "url": "https://www.moneycontrol.com/rss/marketreports.xml",
        "category": "market",
    },
    {
        "name": "ET Markets",
        "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
        "category": "market",
    },
    {
        "name": "Moneycontrol Stocks",
        "url": "https://www.moneycontrol.com/rss/latestnews.xml",
        "category": "stocks",
    },
    {
        "name": "Livemint Markets",
        "url": "https://www.livemint.com/rss/markets",
        "category": "market",
    },
    {
        "name": "NDTV Profit",
        "url": "https://feeds.feedburner.com/ndtvprofit-latest",
        "category": "market",
    },
    {
        "name": "Business Standard",
        "url": "https://www.business-standard.com/rss/markets-106.rss",
        "category": "market",
    },
    # === STOCK-SPECIFIC NEWS ===
    {
        "name": "ET Stocks",
        "url": "https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms",
        "category": "stocks",
    },
    {
        "name": "Moneycontrol MF",
        "url": "https://www.moneycontrol.com/rss/MFreports.xml",
        "category": "market",
    },
    # === GLOBAL (affects Indian market) ===
    {
        "name": "Reuters Business",
        "url": "https://www.reutersagency.com/feed/?best-sectors=business-finance&post_type=best",
        "category": "global",
    },
    {
        "name": "CNBC World",
        "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362",
        "category": "global",
    },
    # === SOCIAL / COMMUNITY ===
    {
        "name": "TradingView India",
        "url": "https://www.tradingview.com/feed/?sort=hot&stream=india",
        "category": "social",
    },
    {
        "name": "Zerodha Varsity",
        "url": "https://zerodha.com/varsity/feed/",
        "category": "education",
    },
    {
        "name": "Reddit IndianStockMarket",
        "url": "https://www.reddit.com/r/IndianStockMarket/hot.rss",
        "category": "social",
    },
    {
        "name": "Reddit IndianStreetBets",
        "url": "https://www.reddit.com/r/IndianStreetBets/hot.rss",
        "category": "social",
    },
    {
        "name": "Reddit DalalStreetTalks",
        "url": "https://www.reddit.com/r/DalalStreetTalks/hot.rss",
        "category": "social",
    },
    {
        "name": "Reddit Nifty50",
        "url": "https://www.reddit.com/r/Nifty50/hot.rss",
        "category": "social",
    },
    {
        "name": "Reddit Trading India",
        "url": "https://www.reddit.com/r/tradingindia/hot.rss",
        "category": "social",
    },
    {
        "name": "Reddit OptionsTrading IN",
        "url": "https://www.reddit.com/r/IndianOptions/hot.rss",
        "category": "social",
    },
    # === MORE FINANCIAL NEWS ===
    {
        "name": "Mint Economy",
        "url": "https://www.livemint.com/rss/economy",
        "category": "market",
    },
    {
        "name": "ET Industry",
        "url": "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
        "category": "stocks",
    },
    {
        "name": "Moneycontrol IPO",
        "url": "https://www.moneycontrol.com/rss/ipo.xml",
        "category": "stocks",
    },
    {
        "name": "Moneycontrol Commodities",
        "url": "https://www.moneycontrol.com/rss/commodities.xml",
        "category": "market",
    },
    {
        "name": "Financial Express",
        "url": "https://www.financialexpress.com/market/feed/",
        "category": "market",
    },
    {
        "name": "Investing.com India",
        "url": "https://www.investing.com/rss/news_301.rss",
        "category": "market",
    },
    # === GLOBAL MACRO ===
    {
        "name": "Bloomberg Markets",
        "url": "https://feeds.bloomberg.com/markets/news.rss",
        "category": "global",
    },
    {
        "name": "Yahoo Finance",
        "url": "https://finance.yahoo.com/news/rssindex",
        "category": "global",
    },
    {
        "name": "MarketWatch",
        "url": "https://feeds.content.dowjones.io/public/rss/mw_topstories",
        "category": "global",
    },
]

# Simple keyword-based sentiment (no ML needed — fast and effective)
BULLISH_WORDS = [
    "rally", "surge", "gain", "rise", "high", "bull", "buy", "upgrade",
    "outperform", "record", "breakout", "positive", "profit", "boom",
    "recover", "strong", "growth", "beat", "up", "jump", "soar",
    "optimistic", "fii buying", "dii buying", "inflow",
]
BEARISH_WORDS = [
    "fall", "drop", "crash", "bear", "sell", "downgrade", "low",
    "loss", "weak", "decline", "fear", "panic", "correction",
    "negative", "risk", "warning", "slump", "plunge", "outflow",
    "fii selling", "crisis", "recession", "inflation worry",
]


@dataclass
class NewsItem:
    title: str
    summary: str  # Simple 1-line explanation of what this means
    source: str
    category: str
    sentiment: str  # "BULLISH", "BEARISH", "NEUTRAL"
    sentiment_score: int  # 0-100 (50=neutral, >50=bullish, <50=bearish)
    impact: str  # "HIGH", "MEDIUM", "LOW" — how much this affects the market
    published: Optional[str] = None
    link: Optional[str] = None


@dataclass
class MarketNewsState:
    items: list[NewsItem] = field(default_factory=list)
    overall_mood: str = "NEUTRAL"  # BULLISH / BEARISH / NEUTRAL
    mood_score: int = 50  # 0-100
    last_fetched: Optional[datetime] = None
    error: Optional[str] = None


# Cache
_news_cache: Optional[MarketNewsState] = None
_CACHE_TTL = timedelta(minutes=10)


def _compute_sentiment(text: str) -> tuple[str, int]:
    """Keyword-based sentiment (fallback). Returns (label, score 0-100)."""
    text_lower = text.lower()
    bull_count = sum(1 for w in BULLISH_WORDS if w in text_lower)
    bear_count = sum(1 for w in BEARISH_WORDS if w in text_lower)

    total = bull_count + bear_count
    if total == 0:
        return "NEUTRAL", 50

    score = int(50 + (bull_count - bear_count) / max(total, 1) * 40)
    score = max(10, min(90, score))

    if score >= 60:
        return "BULLISH", score
    elif score <= 40:
        return "BEARISH", score
    return "NEUTRAL", score


def _compute_impact(title: str, category: str) -> str:
    """Determine how impactful this news is for trading."""
    title_lower = title.lower()
    high_impact = ["rbi", "fed", "nifty", "sensex", "budget", "policy", "rate",
                   "fii", "dii", "ban", "crash", "circuit", "halt", "tariff",
                   "inflation", "gdp", "trade deal", "war", "election"]
    medium_impact = ["quarterly", "earnings", "results", "sector", "index",
                     "upgrade", "downgrade", "target", "ipo", "listing"]

    if any(w in title_lower for w in high_impact):
        return "HIGH"
    if any(w in title_lower for w in medium_impact):
        return "MEDIUM"
    return "LOW"


def _generate_simple_explanation(title: str, sentiment: str) -> str:
    """Generate a simple 1-line explanation that anyone can understand.
    
    This tells the reader: what happened + what it means for stocks.
    """
    title_lower = title.lower()

    # Stock-specific news
    if "rise" in title_lower or "surge" in title_lower or "jump" in title_lower or "soar" in title_lower:
        # Extract stock name if possible
        return "This stock is going up. Positive momentum — could continue if volume supports it."
    if "fall" in title_lower or "drop" in title_lower or "plunge" in title_lower or "tumble" in title_lower:
        return "This stock/sector is falling. Stay away unless you see a reversal setup."

    # Market-wide
    if "nifty" in title_lower or "sensex" in title_lower:
        if sentiment == "BULLISH":
            return "Indian market indices are doing well. Good day to look for buying opportunities."
        elif sentiment == "BEARISH":
            return "Market indices are weak. Be careful — wait for things to stabilize before buying."
        return "Market is moving sideways. No clear direction — pick only strong individual stocks."

    # FII/DII
    if "fii" in title_lower or "dii" in title_lower:
        if "buy" in title_lower or "inflow" in title_lower:
            return "Big institutions are putting money into Indian stocks. This is a positive sign."
        if "sell" in title_lower or "outflow" in title_lower:
            return "Big institutions are pulling money out. Markets may stay under pressure."
        return "Institutional money flow update — check if they're buying or selling."

    # RBI / Policy
    if "rbi" in title_lower or "rate" in title_lower:
        if "cut" in title_lower:
            return "Interest rate cut expected/announced. Good for banks and overall market."
        if "hike" in title_lower:
            return "Interest rate hike — can slow down growth. Be cautious with high-debt stocks."
        return "Central bank policy update — can move the whole market. Watch closely."

    # Earnings/Results
    if "earnings" in title_lower or "results" in title_lower or "profit" in title_lower:
        if sentiment == "BULLISH":
            return "Good company results. Stock may rally — check if already priced in."
        elif sentiment == "BEARISH":
            return "Weak results reported. Stock may fall further. Avoid catching the dip."
        return "Company results are out. Read the numbers before trading this stock."

    # Trade/Tariff
    if "tariff" in title_lower or "trade deal" in title_lower or "trade war" in title_lower:
        if sentiment == "BULLISH":
            return "Trade tensions easing. Export stocks and IT may benefit."
        return "Trade uncertainty — can affect IT, pharma, and export stocks. Stay cautious."

    # Sector news
    if "sector" in title_lower or "metal" in title_lower or "pharma" in title_lower or "it " in title_lower or "bank" in title_lower:
        if sentiment == "BULLISH":
            return "This sector is showing strength. Look for the best stock within it."
        elif sentiment == "BEARISH":
            return "This sector is weak right now. Avoid stocks from this group today."
        return "Sector-level news — may affect multiple stocks in this space."

    # IPO/Listing
    if "ipo" in title_lower or "listing" in title_lower:
        return "New stock listing or IPO news. Usually creates short-term volatility."

    # US Market
    if "us market" in title_lower or "wall street" in title_lower or "nasdaq" in title_lower or "dow" in title_lower:
        if sentiment == "BULLISH":
            return "US markets did well. Indian markets often follow — positive opening likely."
        elif sentiment == "BEARISH":
            return "US markets fell. Indian markets may open weak. Wait before buying."
        return "US market update — Indian markets usually take cues from this."

    # Global
    if "global" in title_lower or "world" in title_lower:
        return "Global news that may affect Indian markets indirectly. Keep an eye on it."

    # Default based on sentiment
    if sentiment == "BULLISH":
        return "Positive development — could support stock prices going up."
    elif sentiment == "BEARISH":
        return "Negative development — might put pressure on stock prices."
    return "Market news — no strong impact expected either way."


def _simplify_headline(title: str) -> str:
    """Make headline simpler and shorter for quick reading."""
    # Fix HTML entities
    import html
    title = html.unescape(title)
    # Remove common prefixes
    title = re.sub(r'^(LIVE|BREAKING|UPDATE|ALERT|WATCH):\s*', '', title, flags=re.IGNORECASE)
    # Remove extra whitespace
    title = ' '.join(title.split())
    # Cap length
    if len(title) > 120:
        title = title[:117] + "..."
    return title


async def _fetch_feed(session: aiohttp.ClientSession, feed: dict) -> list[NewsItem]:
    """Fetch and parse a single RSS feed."""
    items = []
    try:
        async with session.get(feed["url"], timeout=aiohttp.ClientTimeout(total=8)) as resp:
            if resp.status != 200:
                logger.warning("Feed %s returned %d", feed["name"], resp.status)
                return []
            text = await resp.text()

        soup = BeautifulSoup(text, "html.parser")
        entries = soup.find_all("item")[:10]  # Top 10 per feed

        for entry in entries:
            title_tag = entry.find("title")
            if not title_tag:
                continue
            title = title_tag.get_text(strip=True)
            if not title:
                continue

            # Get description/summary
            desc_tag = entry.find("description")
            desc = desc_tag.get_text(strip=True)[:200] if desc_tag else ""

            # Get link — handle multiple RSS formats
            link = None
            link_tag = entry.find("link")
            if link_tag:
                # Some feeds put URL in href attribute
                link = link_tag.get("href") or link_tag.get_text(strip=True) or None
            # Fallback: check for <guid> which often contains the URL
            if not link:
                guid_tag = entry.find("guid")
                if guid_tag:
                    guid_text = guid_tag.get_text(strip=True)
                    if guid_text.startswith("http"):
                        link = guid_text

            # Get publish date
            pub_tag = entry.find("pubdate") or entry.find("pubDate")
            pub_date = pub_tag.get_text(strip=True) if pub_tag else None

            # Compute sentiment from title + description
            combined = f"{title} {desc}"
            sentiment, score = _compute_sentiment(combined)

            # Generate simple explanation and impact level
            clean_title = _simplify_headline(title)
            explanation = _generate_simple_explanation(clean_title, sentiment)
            impact = _compute_impact(clean_title, feed["category"])

            items.append(NewsItem(
                title=clean_title,
                summary=explanation,
                source=feed["name"],
                category=feed["category"],
                sentiment=sentiment,
                sentiment_score=score,
                impact=impact,
                published=pub_date,
                link=link,
            ))

    except asyncio.TimeoutError:
        logger.warning("Feed %s timed out", feed["name"])
    except Exception as e:
        logger.warning("Feed %s failed: %s", feed["name"], str(e)[:80])

    return items


async def fetch_market_news() -> MarketNewsState:
    """Fetch news from all sources. Uses AI for sentiment when available, falls back to keywords."""
    global _news_cache

    if _news_cache and _news_cache.last_fetched:
        if datetime.now() - _news_cache.last_fetched < _CACHE_TTL:
            return _news_cache

    all_items: list[NewsItem] = []
    try:
        async with aiohttp.ClientSession(
            headers={"User-Agent": "TradePilot/3.4 (News Aggregator)"}
        ) as session:
            tasks = [_fetch_feed(session, feed) for feed in NEWS_FEEDS]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, list):
                    all_items.extend(result)

    except Exception as e:
        logger.error("News fetch failed: %s", str(e)[:100])
        if _news_cache:
            return _news_cache
        return MarketNewsState(error=str(e)[:100])

    # Remove duplicates (by title similarity)
    seen_titles = set()
    unique_items = []
    for item in all_items:
        title_key = item.title[:50].lower()
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique_items.append(item)

    # --- AI SENTIMENT ENHANCEMENT ---
    # Try AI-powered sentiment analysis for more accurate scoring
    try:
        from tradepilot.layer2.engine_ai import ai_sentiment_batch
        headlines = [item.title for item in unique_items[:15]]
        ai_result = await ai_sentiment_batch(headlines)

        if ai_result and "scores" in ai_result:
            scores_list = ai_result["scores"]
            for i, item in enumerate(unique_items[:len(scores_list)]):
                if i < len(scores_list):
                    try:
                        score = int(scores_list[i])
                        score = max(10, min(90, score))
                        item.sentiment_score = score
                        if score >= 60:
                            item.sentiment = "BULLISH"
                        elif score <= 40:
                            item.sentiment = "BEARISH"
                        else:
                            item.sentiment = "NEUTRAL"
                    except (ValueError, TypeError):
                        pass  # Keep keyword-based score

            # Use AI overall mood if available
            if ai_result.get("overall_mood"):
                ai_mood = ai_result["overall_mood"]
                ai_mood_score = ai_result.get("mood_score", 50)
            else:
                ai_mood = None
                ai_mood_score = None

            logger.info("AI sentiment applied to %d headlines", min(len(scores_list), len(unique_items)))
        else:
            ai_mood = None
            ai_mood_score = None
    except Exception as e:
        logger.debug("AI sentiment unavailable, using keyword fallback: %s", str(e)[:60])
        ai_mood = None
        ai_mood_score = None

    # Sort by impact first (HIGH > MEDIUM > LOW), then by market category
    impact_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    unique_items.sort(key=lambda x: (impact_order.get(x.impact, 2), 0 if x.category == "market" else 1))

    # Compute overall mood (AI-enhanced or fallback to average)
    if ai_mood and ai_mood_score:
        mood = ai_mood
        avg_score = ai_mood_score
    elif unique_items:
        avg_score = sum(i.sentiment_score for i in unique_items) / len(unique_items)
        if avg_score >= 58:
            mood = "BULLISH"
        elif avg_score <= 42:
            mood = "BEARISH"
        else:
            mood = "NEUTRAL"
    else:
        avg_score = 50
        mood = "NEUTRAL"

    state = MarketNewsState(
        items=unique_items[:20],  # Keep top 20
        overall_mood=mood,
        mood_score=int(avg_score),
        last_fetched=datetime.now(),
    )
    _news_cache = state
    logger.info("News fetched: %d items, mood=%s (score %d)", len(unique_items), mood, int(avg_score))
    return state


def get_news_sentiment_score() -> float:
    """Get current news sentiment as a score 0-100 for Engine 4.
    Returns 55 (neutral) if no news data available."""
    if _news_cache and _news_cache.items:
        return float(_news_cache.mood_score)
    return 55.0
