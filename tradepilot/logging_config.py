"""Structured logging configuration for TradePilot.

Uses stdlib logging with JSON-like formatting for Railway log aggregation.
"""

import logging
import sys
from datetime import datetime


class TradePilotFormatter(logging.Formatter):
    """Compact structured formatter suitable for Railway log viewer."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.fromtimestamp(record.created).strftime("%H:%M:%S")
        level = record.levelname[0]  # D/I/W/E/C
        name = record.name.replace("tradepilot.", "")
        msg = record.getMessage()
        base = f"[{timestamp}] {level} {name}: {msg}"
        if record.exc_info:
            base += f"\n{self.formatException(record.exc_info)}"
        return base


def setup_logging(level: str = "INFO"):
    """Configure logging for the entire application."""
    root = logging.getLogger("tradepilot")
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Console handler (stdout — Railway captures this)
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(TradePilotFormatter())
    root.addHandler(handler)

    # Suppress noisy third-party loggers
    logging.getLogger("yfinance").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)

    return root
