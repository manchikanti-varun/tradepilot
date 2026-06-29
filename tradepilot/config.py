"""Central configuration for TradePilot."""

from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum
import os

# Paths
BASE_DIR = Path(__file__).parent.parent
DB_PATH = BASE_DIR / "data" / "tradepilot.db"
DATA_DIR = BASE_DIR / "data"

# Ensure data directory exists
DATA_DIR.mkdir(parents=True, exist_ok=True)

# =============================================================================
# FEATURE FLAGS — all engines active by default for this trial.
# Each can be individually toggled off to isolate failures during validation.
# =============================================================================
ENABLE_ENGINE2_FII_DII = True
ENABLE_ENGINE3_BREADTH = True
ENABLE_ENGINE13_EVENTS = True
ENABLE_ENGINE14_OPPORTUNITY_COST = True
ENABLE_ENGINE15_CALIBRATION = True
ENABLE_ENGINE17_REGIME = True
ENABLE_ENGINE18_COACH = True
ENABLE_ENGINE19_STRATEGY = True
ENABLE_ENGINE20_SELF_AUDIT = True
ENABLE_ENGINE23_ARCHIVE = True

# GitHub backup config (token from env var, never logged/hardcoded)
GITHUB_BACKUP_REPO = os.environ.get("GITHUB_BACKUP_REPO", "")  # e.g. "username/tradepilot-data"
GITHUB_BACKUP_TOKEN = os.environ.get("GITHUB_BACKUP_TOKEN", "")  # PAT with repo scope


class MarketMode(str, Enum):
    NORMAL = "NORMAL"
    HIGH_VOL = "HIGH_VOL"
    TRENDING = "TRENDING"


class RiskGate(str, Enum):
    GO = "GO"
    CAUTION = "CAUTION"
    HARD_STOP = "HARD_STOP"


class Grade(str, Enum):
    A_PLUS = "A+"
    A = "A"
    B = "B"
    C = "C"
    D = "D"


class TradePhase(str, Enum):
    HOLDING = "HOLDING"
    TRAILING = "TRAILING"
    EXTENDED = "EXTENDED"


class CapitalTier(str, Enum):
    A = "A"
    B = "B"
    C = "C"
    D = "D"


@dataclass
class TierConfig:
    tier: CapitalTier
    range_min: float
    range_max: float
    max_risk_pct_proven: float
    max_risk_pct_unproven: float
    leverage: float
    price_max_formula: str  # "min(X, capital*leverage/2)" or "3000"
    watchlist_source: str  # "Nifty200" or "Nifty500"


TIER_CONFIGS = {
    CapitalTier.A: TierConfig(
        tier=CapitalTier.A,
        range_min=1000, range_max=2000,
        max_risk_pct_proven=8.0, max_risk_pct_unproven=2.0,
        leverage=5.0, price_max_formula="min(2500, capital*leverage/2)",
        watchlist_source="Nifty200",
    ),
    CapitalTier.B: TierConfig(
        tier=CapitalTier.B,
        range_min=2000, range_max=5000,
        max_risk_pct_proven=10.0, max_risk_pct_unproven=3.0,
        leverage=5.0, price_max_formula="min(3000, capital*leverage/2)",
        watchlist_source="Nifty200",
    ),
    CapitalTier.C: TierConfig(
        tier=CapitalTier.C,
        range_min=5000, range_max=10000,
        max_risk_pct_proven=12.0, max_risk_pct_unproven=4.0,
        leverage=5.0, price_max_formula="3000",
        watchlist_source="Nifty200",
    ),
    CapitalTier.D: TierConfig(
        tier=CapitalTier.D,
        range_min=10000, range_max=10000000,
        max_risk_pct_proven=15.0, max_risk_pct_unproven=5.0,
        leverage=5.0, price_max_formula="3000",
        watchlist_source="Nifty500",
    ),
}


# Market hours (IST)
MARKET_OPEN_HOUR = 9
MARKET_OPEN_MINUTE = 15
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 30
ENTRY_START_HOUR = 9
ENTRY_START_MINUTE = 20
ENTRY_END_HOUR = 14
ENTRY_END_MINUTE = 40
FORCE_EXIT_HOUR = 14
FORCE_EXIT_MINUTE = 50

# Engine intervals
LIVE_PIPELINE_INTERVAL_SEC = 90  # 1.5 min
POSITION_MONITOR_INTERVAL_SEC = 60  # 1 min
PREMARKET_INTERVAL_SEC = 480  # 8 min

# Scoring thresholds
# NOTE: With news_score hardcoded at 55 (Phase 0), reaching 75 requires
# near-perfect technicals + volume + momentum. Threshold adjusted to 65
# for the unproven/validation phase. Will tighten once real news engine is live.
MIN_COMPOSITE_FOR_ENTRY = 65  # Grade B+ minimum (A/A+ preferred)
MIN_COMPOSITE_A_PLUS = 80
CHARGE_GATE_MAX_BREAKEVEN_PCT = 1.8
CHARGE_GATE_MIN_RR = 0.8

# Position management
TRAILING_TRIGGER_ATR_MULT = 0.25
STOP_ATR_MULT = 0.4
TARGET_ATR_MULT = 0.6

# Trail ATR multipliers by market mode — wider in HIGH_VOL to give room
TRAIL_ATR_MULT = {
    "NORMAL": 0.35,
    "HIGH_VOL": 0.55,   # wider stop in volatile markets
    "TRENDING": 0.25,   # tighter trail in trending (ride the move)
}
TRAIL_ATR_MULT_EXTENDED = 0.6  # EXTENDED phase always uses this

# Risk manager
MAX_TRADES_PER_DAY = 4
MAX_CONSECUTIVE_LOSSES = 3
VIX_HIGH_THRESHOLD = 22
VIX_CAUTION_THRESHOLD = 17
NIFTY_DOWN_THRESHOLD_PCT = 1.2

# Volume filter
MIN_AVG_DAILY_VOLUME = 500_000
MIN_PRICE = 50

# FIX 6.3: NSE weekday holidays (pipeline must not run on these days)
# Source: NSE official circular + Groww/Moneycontrol verified lists
NSE_HOLIDAYS = {
    # 2025
    "2025-01-26", "2025-02-26", "2025-03-14", "2025-03-31",
    "2025-04-10", "2025-04-14", "2025-04-18", "2025-05-01",
    "2025-08-15", "2025-08-27", "2025-10-02", "2025-10-21",
    "2025-10-22", "2025-11-05", "2025-11-26", "2025-12-25",
    # 2026 (verified from NSE circular / Moneycontrol / Groww)
    "2026-01-15",  # Municipal Corporation Election - Maharashtra
    "2026-01-26",  # Republic Day
    "2026-03-03",  # Holi
    "2026-03-26",  # Rang Panchami / Janma Ashtami (some lists show this)
    "2026-03-31",  # Shri Mahavir Jayanti
    "2026-04-03",  # Good Friday
    "2026-04-14",  # Dr. Baba Saheb Ambedkar Jayanti
    "2026-05-01",  # Maharashtra Day
    "2026-05-28",  # Bakri Id (Eid ul-Adha)
    "2026-06-26",  # Muharram
    "2026-08-21",  # Ganesh Chaturthi
    "2026-10-02",  # Mahatma Gandhi Jayanti
    "2026-10-12",  # Dussehra
    "2026-11-09",  # Diwali - Balipratipada
    "2026-11-24",  # Prakash Gurpurb Sri Guru Nanak Dev
    "2026-12-25",  # Christmas
}

# Hard daily loss cap (FIX 4.2)
HARD_DAILY_LOSS_CAP_PCT = 3.0
