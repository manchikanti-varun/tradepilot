"""Engine 25: Trade Intake Engine — the engine that replaces a broker.

Accepts free-text or structured input. Must reliably parse trade reports.
This is the single point where real-world truth enters the system.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from thefuzz import fuzz, process

from tradepilot.layer1.nifty_universe import get_symbol_list, get_sector_map

# Load symbols and sector map from the universe module
NIFTY200_SYMBOLS = get_symbol_list(include_nifty500=True)
SECTOR_MAP = get_sector_map(include_nifty500=True)


# Symbol aliases for common names
SYMBOL_ALIASES = {
    "SBI": "SBIN",
    "STATE BANK": "SBIN",
    "RELIANCE": "RELIANCE",
    "RIL": "RELIANCE",
    "TATA MOTORS": "TATAMOTORS",
    "HDFC BANK": "HDFCBANK",
    "ICICI BANK": "ICICIBANK",
    "INFOSYS": "INFY",
    "TATA STEEL": "TATASTEEL",
    "AXIS BANK": "AXISBANK",
    "KOTAK": "KOTAKBANK",
    "KOTAK BANK": "KOTAKBANK",
    "BAJAJ FINANCE": "BAJFINANCE",
    "BAJAJ FINSERV": "BAJAJFINSV",
    "HCL TECH": "HCLTECH",
    "TECH MAHINDRA": "TECHM",
    "ASIAN PAINTS": "ASIANPAINT",
    "SUN PHARMA": "SUNPHARMA",
    "DR REDDY": "DRREDDY",
    "DR REDDYS": "DRREDDY",
    "HERO MOTO": "HEROMOTOCO",
    "HINDUSTAN UNILEVER": "HINDUNILVR",
    "HUL": "HINDUNILVR",
    "MAHINDRA": "M&M",
    "M AND M": "M&M",
    "L AND T": "LT",
    "LARSEN": "LT",
}

# Intent keywords
BUY_KEYWORDS = {"buy", "bought", "entered", "in", "entry", "long"}
SELL_KEYWORDS = {"sell", "sold", "exited", "out", "exit", "booked", "squared"}


@dataclass
class ParsedIntake:
    intent: str  # "BUY", "SELL", "AMBIGUOUS"
    ticker: Optional[str]
    price: Optional[float]
    qty: Optional[int]
    confidence: float  # 0-1
    ambiguous_fields: list[str]
    clarification_needed: Optional[str]
    raw_input: str
    echo_message: str  # "Got it — BUY SBIN, ₹845, qty 4, just now. Confirm?"


def parse_trade_input(text: str) -> ParsedIntake:
    """
    Parse free-text trade report.
    Handles: "BUY SBIN 845 4", "Bought SBI at 845, qty 4", "Sold SBIN at 858", etc.
    """
    raw = text.strip()
    lower = raw.lower()
    words = raw.split()

    # 1. Detect intent
    intent = _detect_intent(lower)

    # 2. Extract ticker
    ticker = _extract_ticker(raw, words)

    # 3. Extract price
    price = _extract_price(raw)

    # 4. Extract quantity
    qty = _extract_qty(raw, price)

    # 5. Build confidence and check ambiguity
    ambiguous = []
    if intent == "AMBIGUOUS":
        ambiguous.append("intent")
    if ticker is None:
        ambiguous.append("ticker")
    if price is None:
        ambiguous.append("price")
    if qty is None:
        ambiguous.append("qty")

    confidence = 1.0 - len(ambiguous) * 0.25

    # 6. Generate clarification question if needed
    clarification = None
    if ambiguous:
        if "intent" in ambiguous:
            clarification = "Was this a BUY (entry) or SELL (exit)?"
        elif "ticker" in ambiguous:
            clarification = "Which stock? I couldn't identify the ticker."
        elif "price" in ambiguous:
            clarification = f"Got {intent} {ticker} — what was the price?"
        elif "qty" in ambiguous:
            clarification = f"Got {intent} {ticker} at ₹{price:.2f} — how many shares?"

    # 7. Echo message
    if not ambiguous:
        echo = (
            f"Got it — {intent} {ticker}, ₹{price:.2f}, qty {qty}, just now. Confirm?"
        )
    else:
        echo = clarification or "I need more details about this trade."

    return ParsedIntake(
        intent=intent,
        ticker=ticker,
        price=price,
        qty=qty,
        confidence=confidence,
        ambiguous_fields=ambiguous,
        clarification_needed=clarification,
        raw_input=raw,
        echo_message=echo,
    )


def _detect_intent(lower: str) -> str:
    """Detect BUY/SELL intent from keywords."""
    words_set = set(re.findall(r'\w+', lower))
    buy_match = words_set & BUY_KEYWORDS
    sell_match = words_set & SELL_KEYWORDS

    if buy_match and not sell_match:
        return "BUY"
    elif sell_match and not buy_match:
        return "SELL"
    elif buy_match and sell_match:
        return "AMBIGUOUS"
    else:
        # Default heuristic: if it looks like "TICKER PRICE QTY" → probably BUY
        return "AMBIGUOUS"


def _extract_ticker(raw: str, words: list[str]) -> Optional[str]:
    """Extract ticker symbol, with fuzzy matching on company names."""
    upper_words = [w.upper().strip(",.₹") for w in words]

    # Direct symbol match
    for w in upper_words:
        if w in NIFTY200_SYMBOLS:
            return w

    # Check aliases
    for alias, symbol in SYMBOL_ALIASES.items():
        if alias.upper() in raw.upper():
            return symbol

    # Fuzzy match against symbols
    for w in upper_words:
        if len(w) >= 3:
            match = process.extractOne(w, NIFTY200_SYMBOLS, scorer=fuzz.ratio)
            if match and match[1] >= 80:
                return match[0]

    # Fuzzy match against aliases
    cleaned = raw.upper()
    for alias, symbol in SYMBOL_ALIASES.items():
        if fuzz.partial_ratio(alias, cleaned) >= 85:
            return symbol

    return None


def _extract_price(raw: str) -> Optional[float]:
    """Extract price — first number with ₹/Rs prefix or standalone decimal."""
    # Pattern: ₹845, Rs845, Rs.845, at 845, @845
    patterns = [
        r'[₹Rs.]+\s*(\d+\.?\d*)',
        r'@\s*(\d+\.?\d*)',
        r'at\s+(\d+\.?\d*)',
        r'price\s+(\d+\.?\d*)',
    ]
    for pat in patterns:
        match = re.search(pat, raw, re.IGNORECASE)
        if match:
            return float(match.group(1))

    # Fallback: find numbers that look like prices (3-5 digits, possibly decimal)
    numbers = re.findall(r'\b(\d{2,5}\.?\d{0,2})\b', raw)
    # Filter out likely qty (single digit) and keep price-like numbers
    price_candidates = [float(n) for n in numbers if 10 <= float(n) <= 50000]
    if price_candidates:
        return price_candidates[0]

    return None


def _extract_qty(raw: str, known_price: Optional[float]) -> Optional[int]:
    """Extract quantity."""
    # Pattern: qty 4, shares 4, x4, ×4
    patterns = [
        r'qty\s*[=:]?\s*(\d+)',
        r'(\d+)\s*(?:shares|qty|lots)',
        r'[x×]\s*(\d+)',
        r'(\d+)\s*[x×]',
    ]
    for pat in patterns:
        match = re.search(pat, raw, re.IGNORECASE)
        if match:
            return int(match.group(1))

    # Heuristic: if we found a price, look for a second small number
    numbers = re.findall(r'\b(\d+)\b', raw)
    int_numbers = [int(n) for n in numbers]

    if known_price is not None:
        # Remove the price from candidates
        candidates = [n for n in int_numbers if abs(n - known_price) > 1 and 1 <= n <= 500]
        if candidates:
            return candidates[0]

    # If only one number found and it's small, might be qty
    small_numbers = [n for n in int_numbers if 1 <= n <= 100]
    if len(small_numbers) == 1 and known_price is None:
        return small_numbers[0]

    return None
