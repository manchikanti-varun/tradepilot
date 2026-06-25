"""User Settings — persisted in SQLite, loaded on startup.

All configurable values that the user can change from the Settings page.
Defaults are used until the user explicitly changes them.
"""

import logging
from datetime import datetime
from typing import Optional

from tradepilot.database import get_db

logger = logging.getLogger(__name__)

# Default settings
DEFAULTS = {
    "capital": "5000",
    "max_risk_pct": "12",
    "daily_loss_cap": "500",
    "max_trades_per_day": "4",
    "max_consecutive_losses": "3",
    "vix_halt_threshold": "22",
    "min_signal_score": "60",
    "grade_filter": "A+,A,B",
    "scan_interval_sec": "180",
    "notifications_enabled": "true",
    "sound_enabled": "true",
    "vibration_enabled": "true",
    "theme": "dark",
    "compact_mode": "false",
}


async def get_setting(key: str) -> str:
    """Get a single setting value. Returns default if not set."""
    async with get_db() as db:
        row = await db.execute("SELECT value FROM user_settings WHERE key = ?", (key,))
        data = await row.fetchone()
        if data:
            return data["value"]
    return DEFAULTS.get(key, "")


async def get_all_settings() -> dict:
    """Get all settings as a dict. Merges DB values with defaults."""
    settings = dict(DEFAULTS)
    async with get_db() as db:
        rows = await db.execute("SELECT key, value FROM user_settings")
        async for row in rows:
            settings[row["key"]] = row["value"]
    return settings


async def set_setting(key: str, value: str) -> dict:
    """Set a single setting. Returns the updated key-value."""
    async with get_db() as db:
        await db.execute(
            "INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)",
            (key, value, datetime.now().isoformat()),
        )
        await db.commit()
    logger.info("Setting updated: %s = %s", key, value)
    return {"key": key, "value": value}


async def set_multiple_settings(settings: dict) -> dict:
    """Set multiple settings at once."""
    async with get_db() as db:
        for key, value in settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, ?)",
                (key, str(value), datetime.now().isoformat()),
            )
        await db.commit()
    logger.info("Settings bulk updated: %d keys", len(settings))
    return settings


async def get_setting_float(key: str, default: float = 0.0) -> float:
    """Get a setting as float."""
    val = await get_setting(key)
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


async def get_setting_int(key: str, default: int = 0) -> int:
    """Get a setting as int."""
    val = await get_setting(key)
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


async def get_setting_bool(key: str, default: bool = False) -> bool:
    """Get a setting as bool."""
    val = await get_setting(key)
    return val.lower() in ("true", "1", "yes")
