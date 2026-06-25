"""Engine 27: Market News — fetches and summarizes Indian market news.

Sources (free, no API key):
- Moneycontrol RSS (top stories, market news)
- Economic Times Markets RSS
- NSE announcements (via RSS)

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
    summary: str  # Simple 1-line summary
    source: str
    category: str
    sentiment: str  # "BULLISH", "BEARISH", "NEUTRAL"
    sentiment_score: int  # 0-100 (50=neutral, >50=bullish, <50=bearish)
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
    """Simple keyword-based sentiment. Returns (label, score 0-100)."""
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


def _simplify_headline(title: str) -> str:
    """Make headline simpler and shorter for quick reading."""
    # Remove common prefixes
    title = re.sub(r'^(LIVE|BREAKING|UPDATE|ALERT):\s*', '', title, flags=re.IGNORECASE)
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

            # Get link
            link_tag = entry.find("link")
            link = link_tag.get_text(strip=True) if link_tag else None

            # Get publish date
            pub_tag = entry.find("pubdate") or entry.find("pubDate")
            pub_date = pub_tag.get_text(strip=True) if pub_tag else None

            # Compute sentiment from title + description
            combined = f"{title} {desc}"
            sentiment, score = _compute_sentiment(combined)

            items.append(NewsItem(
                title=_simplify_headline(title),
                summary=desc[:150] if desc else title,
                source=feed["name"],
                category=feed["category"],
                sentiment=sentiment,
                sentiment_score=score,
                published=pub_date,
                link=link,
            ))

    except asyncio.TimeoutError:
        logger.warning("Feed %s timed out", feed["name"])
    except Exception as e:
        logger.warning("Feed %s failed: %s", feed["name"], str(e)[:80])

    return items


async def fetch_market_news() -> MarketNewsState:
    """Fetch news from all sources. Returns cached if fresh."""
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

    # Sort by relevance: market category first, then by recency
    unique_items.sort(key=lambda x: (0 if x.category == "market" else 1))

    # Compute overall mood
    if unique_items:
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
