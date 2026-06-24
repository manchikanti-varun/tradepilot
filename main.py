"""TradePilot AI v3.4 — Main entry point.

Run locally: python main.py
Deploy: Railway uses Procfile → uvicorn tradepilot.api:app --host 0.0.0.0 --port $PORT
"""

import uvicorn
from tradepilot.logging_config import setup_logging

# Initialize logging before anything else
setup_logging("INFO")

if __name__ == "__main__":
    uvicorn.run(
        "tradepilot.api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
