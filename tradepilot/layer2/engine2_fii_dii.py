"""Engine 2: FII/DII Flow Data — institutional money flow signal.

Provides a sentiment modifier based on whether foreign/domestic institutions
are net buyers or sellers. Feeds into Engine 4's scoring.

Data source: NSE daily FII/DII reports (free, published after market hours).
For intraday: uses previous day's data as a bias, not a real-time feed.
"""

from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

from tradepilot.config import ENABLE_ENGINE2_FII_DII


@dataclass
class FIIDIIFlow:
    date: str
    fii_net_buy: float  # positive = net buy, negative = net sell (₹ Cr)
    dii_net_buy: float
    combined_net: float
    signal: str  # "BULLISH", "BEARISH", "NEUTRAL"
    score_modifier: float  # -10 to +10, added to Engine 4's composite


def compute_fii_dii_signal(
    fii_net: float,
    dii_net: float,
) -> FIIDIIFlow:
    """
    Compute FII/DII signal from net buy/sell data.

    Rules:
    - Both buying (fii>0 AND dii>0) → BULLISH (+8 to composite)
    - FII buying, DII selling (fii>500Cr) → BULLISH (+5)
    - Both selling → BEARISH (-8)
    - DII buying strongly to offset FII selling → NEUTRAL (+0)
    - Mixed/small amounts → NEUTRAL (+0)
    """
    if not ENABLE_ENGINE2_FII_DII:
        return FIIDIIFlow(
            date=date.today().isoformat(),
            fii_net_buy=0, dii_net_buy=0, combined_net=0,
            signal="NEUTRAL", score_modifier=0.0,
        )

    combined = fii_net + dii_net

    if fii_net > 500 and dii_net > 500:
        signal = "BULLISH"
        modifier = 8.0
    elif fii_net > 500 and dii_net < -200:
        # FII buying despite DII selling — still bullish
        signal = "BULLISH"
        modifier = 5.0
    elif fii_net < -500 and dii_net < -500:
        signal = "BEARISH"
        modifier = -8.0
    elif fii_net < -500 and dii_net > 500:
        # DII absorbing FII selling — neutral
        signal = "NEUTRAL"
        modifier = 0.0
    elif combined > 1000:
        signal = "BULLISH"
        modifier = 6.0
    elif combined < -1000:
        signal = "BEARISH"
        modifier = -6.0
    else:
        signal = "NEUTRAL"
        modifier = 0.0

    return FIIDIIFlow(
        date=date.today().isoformat(),
        fii_net_buy=fii_net,
        dii_net_buy=dii_net,
        combined_net=combined,
        signal=signal,
        score_modifier=modifier,
    )


# Placeholder: in production, scrape from NSE's FII/DII page or MoneyControl
# For now, returns neutral until a data source is wired
_cached_flow: Optional[FIIDIIFlow] = None


async def get_fii_dii_flow() -> FIIDIIFlow:
    """Get today's FII/DII flow (uses yesterday's data for intraday bias)."""
    global _cached_flow
    if _cached_flow and _cached_flow.date == date.today().isoformat():
        return _cached_flow

    # TODO: Scrape NSE FII/DII data from:
    # https://www.nseindia.com/api/fiidiiTradeReact
    # For now, return neutral
    _cached_flow = FIIDIIFlow(
        date=date.today().isoformat(),
        fii_net_buy=0, dii_net_buy=0, combined_net=0,
        signal="NEUTRAL", score_modifier=0.0,
    )
    return _cached_flow
