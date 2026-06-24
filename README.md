# TradePilot AI v3.4

**AI Trading Co-Pilot — Manual Execution, Zero Broker Integration**

An AI trading co-pilot that continuously decides whether to enter, hold, exit, switch, or avoid a trade based on expected NET profit after charges. You execute every order yourself.

## Quick Start (Local)

```bash
pip install -r requirements.txt
python main.py
# Open http://localhost:8000
```

## Deploy

### Backend → Railway (free tier)

```bash
# Push to GitHub, connect Railway to repo
# Set env vars in Railway dashboard:
#   GITHUB_BACKUP_REPO=username/tradepilot-data
#   GITHUB_BACKUP_TOKEN=ghp_xxx (PAT with repo scope)
# Railway auto-detects Procfile/railway.toml
```

### Frontend → Vercel

```bash
cd frontend
# Connect Vercel to this repo, set root directory to "frontend"
# Update API URL in index.html or set TRADEPILOT_API_URL
vercel deploy
```

### Database Backup

SQLite DB is backed up nightly (23:50 IST) to a private GitHub repo via the GitHub API. Configure via env vars — token is never logged or stored in code.

## Architecture

```
Layer 1: MARKET DATA (Yahoo Finance, free, no API key)
    ↓
Layer 2: DECISION ENGINE (26 engines — all active)
    ↓ text suggestions only
Layer 3: TRADE TRACKER (SQLite logbook, no broker)
```

## All 26 Engines

| # | Engine | Phase | Status |
|---|--------|-------|--------|
| 1 | Market Data Stream | 0 | ✅ Active |
| 2 | FII/DII Flow | 1 | ✅ Active (flag) |
| 3 | Market Breadth | 1 | ✅ Active (flag) |
| 4 | Opportunity Discovery | 0 | ✅ Active |
| 5 | Entry Timing | 0 | ✅ Active |
| 6 | Capital Allocation | 0 | ✅ Active |
| 7 | Trade Simulator (Charge Gate) | 0 | ✅ Active |
| 8 | Charge Calculator | 0 | ✅ Active |
| 9 | Position Management | 0 | ✅ Active |
| 10 | Dynamic Exit | 0 | ✅ Active |
| 11 | Risk Manager | 0 | ✅ Active |
| 12 | Learning Engine | 0 | ✅ Active |
| 13 | Event Calendar | 1 | ✅ Active (flag) |
| 14 | Opportunity Cost | 1 | ✅ Active (flag) |
| 15 | Confidence Calibration | 2 | ✅ Active (self-gates on data) |
| 16 | Post-Entry Re-Eval | 0 | ✅ Active |
| 17 | Market Regime Learner | 2 | ✅ Active (self-gates on data) |
| 18 | AI Trade Coach | 1 | ✅ Active (flag) |
| 19 | Strategy Selection | 2 | ✅ Active (self-gates on data) |
| 20 | Self-Audit | 2 | ✅ Active (self-gates on data) |
| 21 | Capital Growth | 0 | ✅ Active |
| 22 | Rejection Log | 0 | ✅ Active |
| 23 | Opportunity Archive | 1 | ✅ Active (flag) |
| 24 | Reality Check (Nifty) | 0 | ✅ Active |
| 25 | Trade Intake | 0 | ✅ Active |
| 26 | Morning Brief | 0 | ✅ Active |

Phase 2 engines self-gate on data sufficiency (e.g., Engine 15 needs ≥20 trades/bucket).

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | / | Dashboard UI |
| GET | /api/health | Status check |
| GET | /api/state | System state |
| GET | /api/brief/today | Morning brief |
| GET | /api/signals | Ranked signals |
| GET | /api/position | Active position + P&L |
| POST | /api/intake | Report trade (free-text) |
| POST | /api/intake/confirm | Confirm parsed trade |
| GET | /api/rejections/today | Rejection breakdown |
| GET | /api/performance | MVP exit criteria |
| GET | /api/history | Trade history |
| GET | /api/report/today | Engine 18 coach |
| GET | /api/report/weekly | Engine 20 audit |
| GET | /api/report/reality-check | Nifty benchmark |
| GET | /api/watchlist | Scored watchlist |
| GET | /api/growth | Capital growth state |
| GET | /api/opportunity-archive | Hypothetical skips |
| POST | /api/settings | Update config (audit-logged) |
| POST | /api/scan | Dev: trigger scan (rate-limited) |
| POST | /api/monitor | Dev: trigger monitor (rate-limited) |

## Key Constraints

1. **Zero broker integration** — no API keys, no auth, no order placement, anywhere
2. **Zero infra spend** — Railway free tier + Vercel free tier + SQLite + GitHub backup
3. **Single position** — one trade at a time, always
4. **Unproven until proven** — 2-5% risk until Engine 24 validates (50+ trades, beats Nifty)
5. **Charge-aware** — every signal shows net-after-charges and breakeven %
6. **Settings cannot override proven status** — HTTP 403 on any attempt

## Environment Variables

```
GITHUB_BACKUP_REPO=username/tradepilot-data   # Private repo for nightly backup
GITHUB_BACKUP_TOKEN=ghp_xxxxxxxxxxxxx          # PAT with repo scope (never logged)
PORT=8000                                       # Railway sets this automatically
```
