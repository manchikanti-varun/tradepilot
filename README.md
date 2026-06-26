# TradePilot AI

**NSE Intraday Trading Co-Pilot — AI Decides, You Execute**

TradePilot AI is a real-time trading assistant for NSE intraday stocks. It scans 200+ stocks every 90 seconds, runs dual AI analysis (Llama 3.3 70B + Llama 4 Scout), and tells you exactly what to buy, at what price, with stop loss and target — all after accounting for brokerage charges.

You execute every trade manually in Angel One (or any broker). TradePilot never places orders. Zero auto-trading.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  Market Data (Yahoo Finance + optional Angel One real-time)  │
│                           ↓                                  │
│  27 Decision Engines (scoring, filtering, risk gates)        │
│                           ↓                                  │
│  Dual AI Analysis (Groq: Llama 3.3 + Llama 4 Scout)        │
│                           ↓                                  │
│  Signal → You decide in 10-15 seconds → Execute manually    │
│                           ↓                                  │
│  Position Monitor → Exit signals → You close the trade      │
│                           ↓                                  │
│  Trade Tracker (SQLite) → Performance analytics             │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | FastAPI (Python) | REST API, scheduling, AI orchestration |
| Frontend | React 18 + Vite 5 | Trading terminal UI |
| Styling | Tailwind CSS 3 | Design system |
| Charts | Recharts 2 | Price charts, P&L visualization |
| State | Zustand 5 | Global state management |
| Routing | React Router v6 | Client-side navigation |
| Icons | Lucide React | UI iconography |
| AI | Groq API (Llama 3.3 + Llama 4 Scout) | Dual-model stock analysis |
| Data | Yahoo Finance + Angel One SmartAPI | Market data (hybrid mode) |
| Database | SQLite | Trade history, settings, signals |
| Deploy | Railway (backend) + Vercel (frontend) | Cloud hosting |

---

## Quick Start (Local Development)

### Backend

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the backend (port 8000)
python main.py
```

### Frontend

```bash
cd frontend-react

# Install Node dependencies
npm install

# Start dev server (proxies /api to localhost:8000)
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies all `/api` calls to the backend.

### Environment Variables

Create a `.env` file in the project root for the backend:

```env
# Required — Powers AI analysis (free tier: console.groq.com/keys)
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# Optional — Nightly SQLite backup to private GitHub repo
GITHUB_BACKUP_REPO=username/tradepilot-data
GITHUB_BACKUP_TOKEN=ghp_xxxxxxxxxxxxx

# Set by Railway automatically in production
PORT=8000
```

Create `frontend-react/.env` for the frontend:

```env
# Points to your Railway backend URL in production
VITE_API_URL=https://your-app.up.railway.app
```

---

## Project Structure

```
tradepilot-ai/
├── tradepilot/                 # Backend (FastAPI)
│   ├── api.py                  # All REST endpoints
│   ├── auth.py                 # JWT auth, encryption, user management
│   ├── config.py               # Feature flags, constants, tier configs
│   ├── database.py             # SQLite connection manager
│   ├── orchestrator.py         # Pipeline orchestration
│   ├── scheduler.py            # Background job scheduler
│   ├── settings.py             # User settings CRUD
│   ├── logging_config.py       # Structured logging setup
│   ├── backup.py               # Nightly GitHub backup
│   ├── layer1/                 # Market data providers
│   │   ├── yahoo_provider.py   # Yahoo Finance (free, 1-2min delay)
│   │   ├── angel_provider.py   # Angel One SmartAPI (real-time)
│   │   ├── hybrid_provider.py  # Combines both for best of each
│   │   └── nifty_universe.py   # 200+ NSE stock universe
│   ├── layer2/                 # Decision engines (27 engines)
│   │   ├── engine1_data.py     # Market data stream
│   │   ├── engine4_discovery.py # Stock scoring + filtering
│   │   ├── engine5_entry.py    # Entry timing signals
│   │   ├── engine7_simulator.py # Charge gate (blocks unprofitable trades)
│   │   ├── engine8_charges.py  # Angel One charge calculator
│   │   ├── engine10_exit.py    # Dynamic exit signals
│   │   ├── engine11_risk.py    # Risk manager (GO/CAUTION/HARD_STOP)
│   │   ├── engine21_growth.py  # Capital tier progression
│   │   ├── engine25_intake.py  # Natural language trade parser
│   │   ├── engine26_brief.py   # Morning brief generator
│   │   ├── engine27_news.py    # Market news aggregator
│   │   ├── engine_ai.py        # Dual AI model orchestration
│   │   └── ... (27 engines total)
│   └── layer3/
│       └── tracker.py          # Trade history logger
│
├── frontend-react/             # Frontend (React + Vite)
│   ├── src/
│   │   ├── api/                # API client modules
│   │   │   ├── client.js       # Fetch wrapper, JWT refresh + retry
│   │   │   ├── auth.js         # Auth endpoints
│   │   │   ├── market.js       # Market data endpoints
│   │   │   ├── signals.js      # Signal endpoints
│   │   │   ├── position.js     # Position endpoints
│   │   │   ├── history.js      # History + stats endpoints
│   │   │   ├── settings.js     # Settings endpoints
│   │   │   └── sse.js          # SSE connection manager + fallback polling
│   │   ├── store/              # Zustand global state
│   │   │   ├── useAppStore.js  # Auth, notifications, modals
│   │   │   ├── useMarketStore.js # Signals, risk, VIX, scan countdown
│   │   │   └── usePositionStore.js # Active position, P&L, exit signal
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useSSE.js       # SSE connection lifecycle
│   │   │   ├── usePoll.js      # Generic polling with tab-visibility pause
│   │   │   ├── useIST.js       # IST-aware clock (not UTC)
│   │   │   ├── useKeyboard.js  # Global keyboard shortcuts
│   │   │   ├── usePnL.js       # Live P&L with flash animation
│   │   │   └── useMarketHours.js # Market open/close/pre-market logic
│   │   ├── layouts/            # Page layouts
│   │   │   ├── DesktopLayout.jsx # 3-panel fixed layout (260px | flex | 300px)
│   │   │   ├── MobileLayout.jsx  # Bottom tab navigation
│   │   │   └── AuthLayout.jsx    # Centered card layout
│   │   ├── panels/             # Desktop panel content
│   │   │   ├── LeftPanel.jsx   # Market pulse, risk, position, stats
│   │   │   ├── CenterPanel.jsx # Signal feed
│   │   │   └── RightPanel.jsx  # Tabbed: brief / news / coach
│   │   ├── components/         # UI components (by domain)
│   │   │   ├── shared/         # Card, Badge, Spinner, Skeleton, Toast, etc.
│   │   │   ├── market/         # MarketPulse, RiskBanner, ScanCountdown
│   │   │   ├── signals/        # SignalCard, SignalFeed, ExpiryTimer
│   │   │   ├── position/       # PositionCard, PnLDisplay, ExitAlert
│   │   │   ├── stats/          # TodayStats, CapitalCard, LossStreak
│   │   │   ├── brief/          # MorningBrief, MorningBriefModal
│   │   │   ├── news/           # NewsFeed, NewsItem, MoodScore
│   │   │   └── coach/          # CoachPanel, LossClassification
│   │   ├── pages/              # Route-level page components
│   │   ├── App.jsx             # Router, auth gate, SSE init
│   │   ├── main.jsx            # React root mount
│   │   └── index.css           # Tailwind + CSS variables + base styles
│   ├── index.html              # HTML shell (Inter + JetBrains Mono fonts)
│   ├── tailwind.config.js      # Custom design tokens
│   ├── vite.config.js          # Vite + dev proxy config
│   └── package.json            # Dependencies
│
├── tests/                      # Python test suite
├── main.py                     # Backend entry point (uvicorn)
├── Procfile                    # Railway deploy command
├── railway.toml                # Railway config
├── requirements.txt            # Python dependencies
└── pyproject.toml              # Python project metadata
```

---

## Architecture

### Three-Layer Backend

```
Layer 1: MARKET DATA
  Yahoo Finance (free, 1-2 min delay) — always available
  Angel One SmartAPI (real-time) — optional, requires credentials
  Hybrid mode: Angel One for LTP + Yahoo for bulk candles

Layer 2: DECISION ENGINES (27 engines)
  Scoring → Filtering → Entry Timing → Risk Gates → AI Analysis → Signal Generation
  Every signal must pass ALL gates before reaching the user

Layer 3: TRADE TRACKER
  SQLite database — all trades, P&L, charges, duration, notes
  Nightly backup to private GitHub repo via API
```

### Frontend Architecture

```
Desktop (1280px+):  Fixed 3-column layout, nothing scrolls except inner panels
  Left 260px:   Market pulse, risk status, position, stats, capital
  Center flex:  Signal feed (the main decision area)
  Right 300px:  Tabbed panel (brief / news / coach)

Mobile (<768px): Bottom tab navigation, single column, vertical scroll
  5 tabs: Home, Signals, Markets, Trades, Settings
```

### Data Flow

```
SSE (real-time push):     signals, position, risk gate, exit signals, scan complete
Polling fallback (5-10s): if SSE unavailable, critical data still updates
Secondary polling (60s):  sectors, movers (less time-sensitive)
One-time fetch:           stats, history, reality check (on page mount)
```

---

## All 27 Engines

| # | Engine | What It Does |
|---|--------|-------------|
| 1 | Market Data Stream | Fetches candles, LTP, volume for 200+ stocks |
| 2 | FII/DII Flow | Institutional flow signal (bullish/bearish) |
| 3 | Market Breadth | Advance/decline ratio for market health |
| 4 | Opportunity Discovery | Scores stocks on RSI, MACD, EMA, volume, VWAP |
| 5 | Entry Timing | Determines optimal entry price and timing |
| 6 | Capital Allocation | Position sizing based on tier and risk rules |
| 7 | Trade Simulator (Charge Gate) | Blocks trades where charges eat the profit |
| 8 | Charge Calculator | Exact Angel One charges (brokerage, STT, GST, stamp) |
| 9 | Position Management | Tracks active trade state (holding, trailing, exit) |
| 10 | Dynamic Exit | Trailing stop loss, mode-aware (normal/trending/volatile) |
| 11 | Risk Manager | GO / CAUTION / HARD_STOP gate (daily loss, VIX, streaks) |
| 12 | Learning Engine | Adapts scoring weights from trade outcomes |
| 13 | Event Calendar | Flags RBI meetings, expiry days, earnings |
| 14 | Opportunity Cost | Compares current trade vs next-best alternative |
| 15 | Confidence Calibration | Adjusts signal confidence based on historical accuracy |
| 16 | Post-Entry Re-Eval | Continuously re-scores position (HOLD/WATCH/EXIT) |
| 17 | Market Regime Learner | Classifies market mode (normal/trending/high-vol) |
| 18 | AI Trade Coach | Post-trade feedback and recommendations |
| 19 | Strategy Selection | Picks best strategy for current regime |
| 20 | Self-Audit | Weekly performance breakdown with root cause analysis |
| 21 | Capital Growth | Tier progression (A→B→C→D) based on proven performance |
| 22 | Rejection Log | Tracks why stocks were filtered out |
| 23 | Opportunity Archive | Hypothetical P&L of skipped signals |
| 24 | Reality Check | Compares your return vs Nifty 50 buy-and-hold |
| 25 | Trade Intake | Natural language parser ("Bought SBIN at 845, qty 4") |
| 26 | Morning Brief | Daily market outlook with AI-generated plan |
| 27 | News Engine | Market news aggregation with sentiment analysis |

---

## API Endpoints

### Authentication (Public)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login → JWT tokens |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Current user + config status |
| POST | `/api/auth/groq-key` | Save Groq API key (encrypted) |
| POST | `/api/auth/broker-credentials` | Save Angel One creds (encrypted) |
| GET | `/api/auth/credentials-status` | Check what's configured |
| POST | `/api/auth/change-password` | Change password |

### Core Trading (Protected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/state` | System state, risk gate, market mode |
| GET | `/api/signals` | Active trading signals (ranked) |
| GET | `/api/position` | Active position + live P&L + exit signal |
| GET | `/api/brief/today` | Morning brief with AI outlook |
| POST | `/api/intake` | Report trade (natural language) |
| POST | `/api/intake/confirm` | Confirm parsed trade |
| GET | `/api/growth` | Capital tier + progress |
| GET | `/api/rejections/today` | Why stocks were filtered today |

### Market Data (Protected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/market/countdown` | Market open/close countdown |
| GET | `/api/market/expiry` | F&O expiry info |
| GET | `/api/market/sectors` | Sector heatmap |
| GET | `/api/market/movers` | Top gainers/losers |
| GET | `/api/market/premarket` | Gap up/down stocks |
| GET | `/api/market/52week` | Stocks near 52-week high/low |
| GET | `/api/watchlist` | Scored stock universe (top 30) |
| GET | `/api/screener` | Bullish/bearish filter |
| GET | `/api/screener/timeframe?tf=X` | Timeframe screener + KST signals |
| GET | `/api/chart/{symbol}?interval=X` | OHLCV candle data |
| GET | `/api/stock/{symbol}/plan` | Full AI analysis + trading plan |
| GET | `/api/stock/{symbol}/multiframe` | Multi-timeframe trend alignment |

### History & Analytics (Protected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/history?limit=N` | Trade history |
| GET | `/api/history/export` | CSV export of all trades |
| GET | `/api/history/{id}/notes` | Trade journal notes |
| POST | `/api/history/{id}/notes` | Add journal note |
| GET | `/api/stats` | Full performance stats + charts |
| GET | `/api/performance` | MVP validation criteria |
| GET | `/api/report/reality-check` | Your return vs Nifty |
| GET | `/api/report/today` | AI coach feedback |
| GET | `/api/insights` | AI-learned trading patterns |
| GET | `/api/news` | Market news feed |
| GET | `/api/news/analyze` | AI news impact analysis |

### Settings & Alerts (Protected)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/settings/all` | All user settings |
| POST | `/api/settings/save` | Save multiple settings |
| POST | `/api/capital` | Update trading capital |
| GET | `/api/favorites` | Pinned stocks |
| POST | `/api/favorites/{symbol}` | Add favorite |
| DELETE | `/api/favorites/{symbol}` | Remove favorite |
| GET | `/api/alerts/price` | Price alerts |
| POST | `/api/alerts/price` | Create price alert |
| DELETE | `/api/alerts/price/{id}` | Delete price alert |

---

## Key Design Decisions

1. **Zero auto-trading** — TradePilot never places orders. It generates signals; you execute in your broker manually.

2. **Charge-aware from day one** — Every signal shows net profit AFTER all charges (brokerage ₹40, STT, GST, exchange fees, stamp duty). A trade that looks profitable but loses to charges is blocked.

3. **Dual AI verification** — Signals require agreement from two independent AI models (Llama 3.3 70B + Llama 4 Scout via Groq). If models disagree, the signal is marked "CONFLICTING" and downgraded.

4. **Risk gates are absolute** — When HARD_STOP fires (3 consecutive losses, daily loss cap hit, VIX > threshold), no signals are shown regardless of AI verdict. No override possible.

5. **Unproven until proven** — New accounts start at 2% risk per trade. Only after 50+ trades with positive returns beating Nifty (Engine 24) does the system unlock higher risk tiers.

6. **10-second decision window** — The UI is designed for a trader sitting at a desk during market hours. Signal cards show everything needed to decide in 10-15 seconds: entry, stop, target, R:R, net profit, AI confidence.

7. **IST-aware throughout** — All time calculations use Asia/Kolkata timezone. Market hours (9:15-15:30), pre-market, post-market states drive the entire UI.

8. **Desktop-first for active trading** — Fixed 3-column layout at 1280px+. No scrolling during market hours — all critical data visible at once. Mobile is supported but optimized for review, not live trading.

---

## Risk Management

| Rule | Trigger | Effect |
|------|---------|--------|
| Daily loss cap | Cumulative loss exceeds threshold | HARD_STOP — all signals paused |
| Consecutive losses | 3 losses in a row | AUTO_STOP — signals paused until next day |
| VIX threshold | VIX > configured level (default 22) | HARD_STOP — too volatile to trade |
| Max trades/day | Configured limit reached | No new entries allowed |
| Charge gate | Net profit after charges ≤ 0 | Signal blocked before reaching user |
| Breakeven check | Breakeven move > 1.8% | Signal blocked (too expensive) |
| Entry window | After 14:40 IST | No new entry signals generated |

---

## Capital Tier System

| Tier | Capital Range | Risk % (Unproven) | Risk % (Proven) |
|------|--------------|-------------------|-----------------|
| A | ₹1,000 – ₹2,000 | 2% | 8% |
| B | ₹2,000 – ₹5,000 | 3% | 8% |
| C | ₹5,000 – ₹10,000 | 4% | 8% |
| D | ₹10,000+ | 5% | 8% |

"Proven" status requires: 50+ completed trades, net positive P&L, beating Nifty 50 returns, and win rate > 55%.

---

## Deployment

### Backend → Railway

```bash
# 1. Push to GitHub
# 2. Connect Railway to the repo
# 3. Set environment variables in Railway dashboard:
#    GROQ_API_KEY=gsk_xxxxxxxxxxxx
#    GITHUB_BACKUP_REPO=username/tradepilot-data (optional)
#    GITHUB_BACKUP_TOKEN=ghp_xxx (optional)
# 4. Railway auto-detects Procfile and deploys
```

### Frontend → Vercel

```bash
# 1. Connect Vercel to the repo
# 2. Set root directory: frontend-react
# 3. Set environment variable:
#    VITE_API_URL=https://your-app.up.railway.app
# 4. Vercel auto-builds with `npm run build`
```

### Database Backup

SQLite DB is backed up nightly at 23:50 IST to a private GitHub repo via the GitHub API. No credentials are stored in code — configure via environment variables.

---

## Keyboard Shortcuts (Desktop)

| Key | Action |
|-----|--------|
| `1-5` | Open signal plan by position |
| `S` | Skip top signal |
| `E` | Log manual exit for active position |
| `M` | Open morning brief |
| `R` | Force refresh all data |
| `Esc` | Close any open modal |
| `?` | Show shortcut overlay |

---

## Data Modes

| Mode | Source | Latency | Requires |
|------|--------|---------|----------|
| Yahoo Only | Yahoo Finance | 1-2 min delay | Nothing (default) |
| Hybrid | Angel One + Yahoo | Real-time LTP | Angel One credentials |

Yahoo-only mode works fine for signal generation. Angel One credentials are optional and only add real-time price precision — no orders are ever placed through the API.

---

## License

Private project. Not open source.
