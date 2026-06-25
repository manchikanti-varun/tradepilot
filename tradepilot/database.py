"""SQLite database initialization and access — production-ready connection management.

Uses async context manager pattern to prevent connection leaks.
WAL mode for concurrent reads. Foreign keys enforced.
"""

import aiosqlite
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from tradepilot.config import DB_PATH

logger = logging.getLogger(__name__)


@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    """
    Async context manager for database connections.
    Guarantees connection is closed even if an exception occurs.

    Usage:
        async with get_db() as db:
            await db.execute(...)
    """
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    await db.execute("PRAGMA busy_timeout=5000")  # Wait up to 5s on lock
    try:
        yield db
    except Exception:
        await db.rollback()
        raise
    finally:
        await db.close()


async def init_db():
    """Initialize all database tables."""
    async with get_db() as db:
        await db.executescript(SCHEMA)
        await db.commit()
    logger.info("Database initialized at %s", DB_PATH)


SCHEMA = """
-- Active and historical trades
CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    sector TEXT,
    entry_time TEXT NOT NULL,
    exit_time TEXT,
    entry_price REAL NOT NULL,
    exit_price REAL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    capital_used REAL NOT NULL,
    capital_tier TEXT NOT NULL,
    leverage REAL NOT NULL,
    gross_pnl REAL,
    total_charges REAL,
    net_pnl REAL,
    net_pnl_pct REAL,
    charge_pct_of_gross REAL,
    composite_score REAL,
    grade TEXT,
    market_mode TEXT,
    entry_reason TEXT,
    exit_reason TEXT,
    hold_duration_min REAL,
    was_profitable INTEGER,
    rsi_at_entry REAL,
    vwap_relation TEXT,
    macd_at_entry REAL,
    news_sentiment_at_entry REAL,
    sector_rank_at_entry TEXT,
    predicted_probability REAL,
    actual_outcome TEXT,
    entry_reported_via TEXT DEFAULT 'engine25',
    exit_reported_via TEXT DEFAULT 'engine25',
    status TEXT DEFAULT 'OPEN',
    peak_price REAL,
    trail_stop REAL,
    stop_price REAL,
    initial_target REAL,
    phase TEXT DEFAULT 'HOLDING',
    atr_at_entry REAL,
    entry_vwap REAL,
    sector_was_top_at_entry INTEGER DEFAULT 0
);

-- Enforce single open position at DB level
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_trade
    ON trades (status) WHERE status = 'OPEN';

-- Daily state for risk manager
CREATE TABLE IF NOT EXISTS daily_state (
    date TEXT PRIMARY KEY,
    trade_count INTEGER DEFAULT 0,
    daily_pnl REAL DEFAULT 0.0,
    consecutive_losses INTEGER DEFAULT 0,
    hard_stop_active INTEGER DEFAULT 0,
    hard_stop_reason TEXT
);

-- Capital growth tracking
CREATE TABLE IF NOT EXISTS growth_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    current_capital REAL NOT NULL DEFAULT 20000.0,
    current_tier TEXT NOT NULL DEFAULT 'D',
    peak_capital REAL NOT NULL DEFAULT 20000.0,
    capital_last_confirmed TEXT,
    is_proven_tier_a INTEGER DEFAULT 0,
    is_proven_tier_b INTEGER DEFAULT 0,
    is_proven_tier_c INTEGER DEFAULT 0,
    is_proven_tier_d INTEGER DEFAULT 0
);

-- Initialize growth state if not exists
INSERT OR IGNORE INTO growth_state (id, current_capital, current_tier, peak_capital)
VALUES (1, 20000.0, 'D', 20000.0);

-- Daily rejection log (Engine 22)
CREATE TABLE IF NOT EXISTS rejection_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    reason TEXT NOT NULL,
    composite_score REAL,
    ltp_at_rejection REAL,
    timestamp TEXT NOT NULL
);

-- Trade history summary (Engine 12)
CREATE TABLE IF NOT EXISTS daily_summary (
    date TEXT PRIMARY KEY,
    total_trades INTEGER DEFAULT 0,
    winning_trades INTEGER DEFAULT 0,
    losing_trades INTEGER DEFAULT 0,
    gross_pnl REAL DEFAULT 0.0,
    total_charges REAL DEFAULT 0.0,
    net_pnl REAL DEFAULT 0.0,
    capital_start REAL,
    capital_end REAL
);

-- Weekly insights
CREATE TABLE IF NOT EXISTS weekly_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    total_trades INTEGER,
    win_rate REAL,
    avg_net_pnl REAL,
    charge_drag_pct REAL,
    best_sector TEXT,
    worst_sector TEXT,
    nifty_return_pct REAL,
    strategy_return_pct REAL,
    outperformance_pct REAL,
    insights_json TEXT
);

-- Settings change log (audit trail)
CREATE TABLE IF NOT EXISTS settings_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    reason TEXT
);

-- Opportunity archive (Engine 23 — hypothetical, NEVER merged into trades)
CREATE TABLE IF NOT EXISTS opportunity_archive (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    ticker TEXT NOT NULL,
    rejection_reason TEXT NOT NULL,
    score_at_rejection REAL,
    ltp_at_rejection REAL,
    close_price_eod REAL,
    hypothetical_move_pct REAL,
    classification TEXT,
    timestamp TEXT NOT NULL
);

-- Intake log (Engine 25 — every message received, for audit/debug)
CREATE TABLE IF NOT EXISTS intake_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    raw_input TEXT NOT NULL,
    parsed_intent TEXT,
    parsed_ticker TEXT,
    parsed_price REAL,
    parsed_qty INTEGER,
    confidence REAL,
    status TEXT,
    trade_id INTEGER,
    clarification_sent TEXT
);

-- Nifty daily values (for Engine 24 historical benchmark)
CREATE TABLE IF NOT EXISTS nifty_daily (
    date TEXT PRIMARY KEY,
    open_value REAL,
    close_value REAL
);

-- Signal history (every signal that fired)
CREATE TABLE IF NOT EXISTS signal_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    symbol TEXT NOT NULL,
    sector TEXT,
    grade TEXT,
    composite REAL,
    ltp REAL,
    qty INTEGER,
    stop_price REAL,
    target REAL,
    net_after_charges REAL,
    risk_reward REAL,
    outcome TEXT DEFAULT 'PENDING'
);

-- Stock universe (live from NSE, refreshed weekly)
CREATE TABLE IF NOT EXISTS stock_universe (
    symbol TEXT PRIMARY KEY,
    company TEXT NOT NULL,
    sector TEXT NOT NULL,
    index_name TEXT NOT NULL,
    added_date TEXT NOT NULL
);

-- User settings (key-value, persisted)
CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Trade notes / journal
CREATE TABLE IF NOT EXISTS trade_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER NOT NULL,
    note TEXT NOT NULL,
    tags TEXT,
    created_at TEXT NOT NULL
);

-- Price alerts (user-set)
CREATE TABLE IF NOT EXISTS price_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    target_price REAL NOT NULL,
    direction TEXT NOT NULL,
    triggered INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    triggered_at TEXT
);

-- Watchlist favorites (pinned stocks)
CREATE TABLE IF NOT EXISTS favorites (
    symbol TEXT PRIMARY KEY,
    added_at TEXT NOT NULL
);

-- Trade insights (learned patterns)
CREATE TABLE IF NOT EXISTS trade_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    insight TEXT NOT NULL,
    data_json TEXT,
    created_at TEXT NOT NULL
);
"""
