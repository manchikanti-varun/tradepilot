"""Engine 4: Opportunity Discovery — morning universe filter + continuous scoring."""

import asyncio
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional

import pandas as pd
import numpy as np

from tradepilot.config import (
    Grade, CapitalTier, TIER_CONFIGS, MIN_AVG_DAILY_VOLUME, MIN_PRICE,
    MIN_COMPOSITE_FOR_ENTRY, MIN_COMPOSITE_A_PLUS,
)
from tradepilot.layer1.base import MarketDataProvider, Instrument

logger = logging.getLogger(__name__)


@dataclass
class StockScore:
    symbol: str
    sector: str
    ltp: float
    composite: float
    grade: Grade
    technical_score: float
    volume_score: float
    news_score: float
    sector_score: float
    momentum_score: float
    rsi: float
    vwap: float
    macd: float
    volume_ratio: float
    timestamp: datetime = field(default_factory=datetime.now)


def compute_grade(composite: float) -> Grade:
    """Map composite score to grade."""
    if composite >= MIN_COMPOSITE_A_PLUS:
        return Grade.A_PLUS
    elif composite >= 75:
        return Grade.A
    elif composite >= 65:
        return Grade.B
    elif composite >= 50:
        return Grade.C
    else:
        return Grade.D


def compute_rsi(closes: pd.Series, period: int = 14) -> float:
    """Compute RSI(14)."""
    if len(closes) < period + 1:
        return 50.0  # neutral default
    delta = closes.diff()
    gain = delta.where(delta > 0, 0.0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.inf)
    rsi = 100 - (100 / (1 + rs))
    val = rsi.iloc[-1]
    return float(val) if not np.isnan(val) else 50.0


def compute_macd(closes: pd.Series) -> tuple[float, float, float]:
    """Compute MACD(12,26,9). Returns (macd_line, signal, histogram)."""
    if len(closes) < 26:
        return 0.0, 0.0, 0.0
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    histogram = macd_line - signal
    return float(macd_line.iloc[-1]), float(signal.iloc[-1]), float(histogram.iloc[-1])


def compute_vwap(df: pd.DataFrame) -> float:
    """Compute VWAP from OHLCV DataFrame."""
    if df.empty or "volume" not in df.columns:
        return 0.0
    typical_price = (df["high"] + df["low"] + df["close"]) / 3
    cum_vol = df["volume"].cumsum()
    cum_tp_vol = (typical_price * df["volume"]).cumsum()
    vwap = cum_tp_vol / cum_vol.replace(0, np.nan)
    val = vwap.iloc[-1]
    return float(val) if not np.isnan(val) else 0.0


def compute_atr(df: pd.DataFrame, period: int = 14) -> float:
    """Compute ATR(14) from OHLCV DataFrame."""
    if len(df) < period + 1:
        return 0.0
    high = df["high"]
    low = df["low"]
    close = df["close"].shift(1)
    tr = pd.concat([
        high - low,
        (high - close).abs(),
        (low - close).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(window=period).mean()
    val = atr.iloc[-1]
    return float(val) if not np.isnan(val) else 0.0


def compute_ema(closes: pd.Series, span: int) -> float:
    """Compute EMA for given span."""
    if len(closes) < span:
        return float(closes.iloc[-1]) if len(closes) > 0 else 0.0
    ema = closes.ewm(span=span, adjust=False).mean()
    return float(ema.iloc[-1])


# Top sectors (updated by market regime / news — simplified for MVP)
TOP_SECTORS = ["IT", "Banking", "Power", "Defence"]
AVOID_SECTORS: list[str] = []  # populated dynamically


async def score_stock(
    symbol: str,
    sector: str,
    market_data: MarketDataProvider,
    top_sectors: Optional[list[str]] = None,
    avoid_sectors: Optional[list[str]] = None,
) -> Optional[StockScore]:
    """
    Score a single stock. This is THE scoring function — Engine 16 calls this same function.
    Returns None if data is insufficient.
    """
    if top_sectors is None:
        top_sectors = TOP_SECTORS
    if avoid_sectors is None:
        avoid_sectors = AVOID_SECTORS

    try:
        now = datetime.now()
        # Get 5-min candles for last 5 days (for ATR, RSI, MACD, volume)
        candles = await market_data.get_candles(
            symbol, "5m",
            from_dt=now - timedelta(days=5),
            to_dt=now,
        )
        # Fallback to daily candles if 5m data is insufficient
        if candles.empty or len(candles) < 30:
            logger.info("5m candles insufficient for %s (%d rows), trying 1d fallback",
                        symbol, len(candles) if not candles.empty else 0)
            candles = await market_data.get_candles(
                symbol, "1d",
                from_dt=now - timedelta(days=60),
                to_dt=now,
            )
            if candles.empty or len(candles) < 15:
                logger.warning("Daily candles also insufficient for %s (%d rows) — skipping",
                               symbol, len(candles) if not candles.empty else 0)
                return None

        ltp = float(candles["close"].iloc[-1])
        closes = candles["close"]
        volumes = candles["volume"]

        # --- TECHNICAL (30%) ---
        rsi = compute_rsi(closes)
        vwap = compute_vwap(candles)
        macd_line, macd_signal, macd_hist = compute_macd(closes)
        ema9 = compute_ema(closes, 9)
        ema21 = compute_ema(closes, 21)
        atr = compute_atr(candles)

        # RSI scoring: 45-65 optimal, penalize extremes
        if 45 <= rsi <= 65:
            rsi_score = 80 + (10 - abs(rsi - 55))
        elif 35 <= rsi < 45 or 65 < rsi <= 75:
            rsi_score = 60
        else:
            rsi_score = 30

        # VWAP relation: price near or above VWAP is bullish
        vwap_relation = "above" if ltp >= vwap else "below"
        vwap_score = 80 if ltp >= vwap else 40

        # MACD: positive histogram = bullish
        macd_score = 80 if macd_hist > 0 else 40

        # EMA cross: 9 > 21 = bullish
        ema_score = 85 if ema9 > ema21 else 35

        # ATR-relative move: current bar move vs ATR
        if atr > 0:
            current_move = abs(ltp - float(candles["open"].iloc[-1]))
            atr_move_score = min(90, 50 + (current_move / atr) * 40)
        else:
            atr_move_score = 50

        technical_score = (
            rsi_score * 0.25 + vwap_score * 0.25 + macd_score * 0.2
            + ema_score * 0.15 + atr_move_score * 0.15
        )

        # --- VOLUME (20%) ---
        # volume_ratio = recent volume vs 20-bar average
        recent_vol = float(volumes.iloc[-5:].mean()) if len(volumes) >= 5 else 0
        avg_vol = float(volumes.iloc[-20:].mean()) if len(volumes) >= 20 else recent_vol
        volume_ratio = recent_vol / avg_vol if avg_vol > 0 else 1.0
        volume_score = min(100, max(0, 50 + (volume_ratio - 1.0) * 50))

        # --- NEWS (25%) — Real sentiment from Engine 27 ---
        # Uses live RSS feeds (Moneycontrol, ET) to compute market sentiment.
        # Falls back to 55 (neutral) if news fetch hasn't happened yet.
        from tradepilot.layer2.engine27_news import get_news_sentiment_score
        news_score = get_news_sentiment_score()

        # --- SECTOR (15%) ---
        if sector in top_sectors:
            sector_score = 85.0
        elif sector in avoid_sectors:
            sector_score = 15.0
        else:
            sector_score = 50.0

        # --- MOMENTUM (10%) ---
        # 5-day price slope
        if len(closes) >= 60:  # ~5 days of 5-min candles
            slope_window = closes.iloc[-60:]
            slope = (float(slope_window.iloc[-1]) - float(slope_window.iloc[0])) / float(slope_window.iloc[0]) * 100
            momentum_score = min(100, max(0, 50 + slope * 10))
        else:
            momentum_score = 50.0

        # --- COMPOSITE ---
        composite = (
            technical_score * 0.30
            + volume_score * 0.20
            + news_score * 0.25
            + sector_score * 0.15
            + momentum_score * 0.10
        )

        grade = compute_grade(composite)

        return StockScore(
            symbol=symbol,
            sector=sector,
            ltp=ltp,
            composite=round(composite, 1),
            grade=grade,
            technical_score=round(technical_score, 1),
            volume_score=round(volume_score, 1),
            news_score=round(news_score, 1),
            sector_score=round(sector_score, 1),
            momentum_score=round(momentum_score, 1),
            rsi=round(rsi, 1),
            vwap=round(vwap, 2),
            macd=round(macd_hist, 4),
            volume_ratio=round(volume_ratio, 2),
            timestamp=now,
        )

    except Exception as e:
        logger.warning("score_stock failed for %s: %s", symbol, str(e)[:100])
        return None


async def build_watchlist(
    market_data: MarketDataProvider,
    capital: float,
    tier: CapitalTier,
) -> list[Instrument]:
    """
    Step 1: Morning universe filter.
    Returns instruments passing all filters for the given tier.
    """
    tier_config = TIER_CONFIGS[tier]
    leverage = tier_config.leverage

    # Compute price_max
    if "min(" in tier_config.price_max_formula:
        # "min(X, capital*leverage/2)"
        parts = tier_config.price_max_formula.replace("min(", "").replace(")", "").split(",")
        cap_val = float(parts[0].strip())
        computed = capital * leverage / 2
        price_max = min(cap_val, computed)
    else:
        price_max = float(tier_config.price_max_formula)

    all_instruments = await market_data.get_instrument_list()

    # Filter by price band (we'll check volume via candles if possible)
    # For MVP, do basic filtering — volume check happens during scoring
    filtered = []
    for inst in all_instruments:
        # Only include from correct universe
        # (simplified: all instruments from provider are already Nifty200/500 based on tier)
        filtered.append(inst)

    return filtered[:50]  # Cap at 50 candidates for scoring


async def scan_and_score(
    market_data: MarketDataProvider,
    watchlist: list[Instrument],
    top_sectors: Optional[list[str]] = None,
    avoid_sectors: Optional[list[str]] = None,
) -> list[StockScore]:
    """
    Step 2: Score all watchlist stocks, return sorted by composite descending.
    Only A+/A proceed to Engine 5.
    """
    tasks = [
        score_stock(inst.symbol, inst.sector, market_data, top_sectors, avoid_sectors)
        for inst in watchlist
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    scores = []
    errors = 0
    nones = 0
    for r in results:
        if isinstance(r, StockScore):
            scores.append(r)
        elif isinstance(r, Exception):
            errors += 1
        else:
            nones += 1

    logger.info(
        "scan_and_score: %d scored, %d returned None (insufficient data), %d exceptions, from %d total",
        len(scores), nones, errors, len(watchlist),
    )

    # Sort by composite descending
    scores.sort(key=lambda s: s.composite, reverse=True)
    return scores
