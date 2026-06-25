"""FastAPI application — production-ready with proper lifespan, validation, logging."""

import time
import logging
from datetime import datetime, date
from typing import Optional
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator

from tradepilot.logging_config import setup_logging
from tradepilot.orchestrator import (
    get_state, initialize, run_live_pipeline, run_position_monitor,
    process_intake, confirm_intake, generate_morning_brief,
)
from tradepilot.scheduler import start_scheduler, stop_scheduler
from tradepilot.layer2.engine21_growth import get_growth_state
from tradepilot.layer2.engine22_rejections import get_daily_rejection_summary
from tradepilot.layer2.engine24_reality import run_reality_check, check_mvp_exit_criteria
from tradepilot.layer2.engine27_news import fetch_market_news
from tradepilot.layer3.tracker import TradeTracker
from tradepilot.config import (
    ENABLE_ENGINE18_COACH, ENABLE_ENGINE20_SELF_AUDIT,
    ENABLE_ENGINE23_ARCHIVE, ENABLE_ENGINE15_CALIBRATION,
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern lifespan handler (replaces deprecated on_event)."""
    setup_logging("INFO")
    logger.info("TradePilot v3.4 starting up...")
    await initialize()
    start_scheduler()
    logger.info("Startup complete — scheduler running")
    yield
    stop_scheduler()
    logger.info("Shutdown complete")


app = FastAPI(
    title="TradePilot AI v3.4",
    description="AI Trading Co-Pilot — Manual Execution, Zero Broker Integration",
    version="3.4.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


@app.get("/")
async def serve_frontend():
    return FileResponse(FRONTEND_DIR / "index.html")


# --- Models with validation ---

class IntakeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)

class ConfirmRequest(BaseModel):
    intent: str
    ticker: str = Field(..., min_length=1, max_length=20)
    price: float = Field(..., gt=0, le=50000)
    qty: int = Field(..., gt=0, le=500)

    @field_validator("intent")
    @classmethod
    def validate_intent(cls, v):
        if v not in ("BUY", "SELL"):
            raise ValueError("intent must be BUY or SELL")
        return v

class SettingsUpdate(BaseModel):
    setting_name: str = Field(..., min_length=1, max_length=50)
    new_value: str = Field(..., max_length=200)
    reason: Optional[str] = Field(None, max_length=500)


# --- Global error handler ---

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Check logs for details."},
    )


# === CORE ENDPOINTS (original 15 from spec) ===

@app.get("/api/health")
async def health():
    """Health check — used by Railway deploy verification AND external keep-alive pings."""
    state = get_state()
    return {
        "status": "healthy",
        "version": "3.4.0",
        "last_scan_time": state.last_scan_time.isoformat() if state.last_scan_time else None,
        "active_trade": state.active_trade.ticker if state.active_trade else None,
        "market_mode": state.market_mode.value,
        "last_error": state.last_error,
    }


@app.get("/api/state")
async def get_system_state():
    state = get_state()
    growth = state.growth_state or await get_growth_state()
    return {
        "market_mode": state.market_mode.value,
        "risk_gate": state.risk_state.gate.value if state.risk_state else "GO",
        "risk_reason": state.risk_state.reason if state.risk_state else None,
        "event_risk": state.event_risk.level if state.event_risk else "NONE",
        "capital_tier": growth.current_tier.value,
        "growth_state": {
            "current_capital": growth.current_capital,
            "current_tier": growth.current_tier.value,
            "progress_pct_to_next_tier": growth.progress_pct_to_next_tier,
            "peak_capital": growth.peak_capital,
            "drawdown_from_peak_pct": growth.drawdown_from_peak_pct,
            "is_proven": growth.is_proven,
        },
    }


@app.get("/api/brief/today")
async def get_morning_brief():
    """Engine 26 morning brief. Omits Phase 1 fields if their engines have no data."""
    state = get_state()
    if state.morning_brief and state.morning_brief.date == datetime.now().strftime("%Y-%m-%d"):
        brief = state.morning_brief
    else:
        brief = await generate_morning_brief()

    response = {
        "date": brief.date,
        "capital_snapshot": brief.capital_snapshot,
        "watchlist_summary": brief.watchlist_summary,
        "risk_state": brief.risk_state,
        "one_line_summary": brief.one_line_summary,
    }
    # Only include Phase 1 fields if they have actual data (not null/empty)
    if brief.event_calendar_today is not None:
        response["event_calendar_today"] = brief.event_calendar_today
    if brief.yesterday_recap is not None:
        response["yesterday_recap"] = brief.yesterday_recap
    return response


@app.get("/api/signals")
async def get_signals():
    state = get_state()
    signals = []
    for s in state.signals:
        signals.append({
            "priority": s.priority,
            "symbol": s.symbol,
            "sector": s.sector,
            "grade": s.grade,
            "composite": s.composite,
            "ltp": s.ltp,
            "qty": s.qty,
            "stop_price": s.stop_price,
            "target": s.target,
            "net_after_charges": s.net_after_charges,
            "breakeven_pct": s.breakeven_pct,
            "risk_reward": s.risk_reward,
            "message": s.message,
            "action": "Buy this in Angel One" if s.priority == 1 else "Next best if Priority #1 fails",
        })
    return {
        "signals": signals,
        "count": len(signals),
        "risk_gate": state.risk_state.gate.value if state.risk_state else "GO",
    }


@app.get("/api/position")
async def get_position():
    state = get_state()
    trade = state.active_trade
    if trade is None:
        return {"active": False, "position": None}

    try:
        ltp = await state.market_data.get_ltp(trade.ticker)
    except Exception:
        ltp = trade.entry_price

    from tradepilot.layer2.engine8_charges import calculate_angel_charges
    gross = trade.qty * (ltp - trade.entry_price)
    charges, _ = calculate_angel_charges(trade.qty, trade.entry_price, ltp)
    net = gross - charges

    return {
        "active": True,
        "position": {
            "trade_id": trade.id, "ticker": trade.ticker, "qty": trade.qty,
            "entry_price": trade.entry_price, "current_ltp": ltp,
            "entry_time": trade.entry_time.isoformat(),
            "phase": trade.phase.value, "stop_price": trade.stop_price,
            "peak_price": trade.peak_price,
            "gross_pnl": round(gross, 2), "charges_estimate": round(charges, 2),
            "net_pnl": round(net, 2),
        },
        "exit_signal": {
            "should_exit": state.exit_signal.should_exit,
            "urgency": state.exit_signal.urgency,
            "reason": state.exit_signal.reason,
            "suggested_exit_price": state.exit_signal.suggested_exit_price,
        } if state.exit_signal else None,
        "reeval": {
            "action": state.reeval_result.action,
            "score": state.reeval_result.re_entry_score,
            "reason": state.reeval_result.reason,
        } if state.reeval_result else None,
    }


@app.post("/api/intake")
async def trade_intake(request: IntakeRequest):
    return await process_intake(request.text)


@app.post("/api/intake/confirm")
async def confirm_trade_intake(request: ConfirmRequest):
    return await confirm_intake({
        "intent": request.intent, "ticker": request.ticker,
        "price": request.price, "qty": request.qty,
    })


@app.get("/api/rejections/today")
async def get_rejections_today():
    state = get_state()
    summary = await get_daily_rejection_summary(
        total_scanned=len(state.watchlist_scores),
        total_entered=1 if state.active_trade else 0,
    )
    return {
        "date": summary.date, "total_scanned": summary.total_scanned,
        "total_rejected": summary.total_rejected,
        "total_passed_to_entry": summary.total_passed_to_entry,
        "total_entered": summary.total_entered,
        "breakdown": summary.breakdown, "headline": summary.top_reason_plain,
    }


@app.get("/api/performance")
async def get_performance():
    return await check_mvp_exit_criteria()


@app.get("/api/history")
async def get_trade_history(limit: int = 60):
    tracker = TradeTracker()
    trades = await tracker.get_trade_history(limit=limit)
    return {
        "trades": [
            {
                "id": t.id, "ticker": t.ticker,
                "entry_price": t.entry_price, "exit_price": t.exit_price,
                "qty": t.qty, "entry_time": t.entry_time.isoformat(),
                "exit_time": t.exit_time.isoformat() if t.exit_time else None,
                "status": t.status, "capital_tier": t.capital_tier,
            }
            for t in trades
        ],
        "count": len(trades),
    }


@app.get("/api/report/today")
async def get_today_report():
    """Engine 18 coach output."""
    if not ENABLE_ENGINE18_COACH:
        return {"status": "disabled", "note": "Engine 18 feature flag is off"}
    from tradepilot.layer2.engine18_coach import generate_coach_report
    report = await generate_coach_report()
    return {
        "date": report.date, "charge_drag_pct": report.charge_drag_today_pct,
        "breakeven_move_pct": report.min_breakeven_move_pct,
        "tier_viable": report.tier_viable, "headline": report.headline,
        "recommendations": report.recommendations,
    }


@app.get("/api/report/weekly")
async def get_weekly_report():
    """Weekly summary from Engine 20 self-audit."""
    if not ENABLE_ENGINE20_SELF_AUDIT:
        return {"status": "disabled"}
    from tradepilot.layer2.engine20_self_audit import run_self_audit
    report = await run_self_audit()
    return {
        "week_start": report.week_start, "week_end": report.week_end,
        "total_losses": report.total_losses, "is_active": report.is_active,
        "breakdown": report.breakdown, "top_cause": report.top_cause,
        "top_fix": report.top_actionable_fix,
    }


@app.get("/api/report/reality-check")
async def reality_check(period_start: Optional[str] = None, period_end: Optional[str] = None):
    state = get_state()
    result = await run_reality_check(state.market_data, period_start, period_end)
    return {
        "period_start": result.period_start, "period_end": result.period_end,
        "starting_capital": result.starting_capital, "ending_capital": result.ending_capital,
        "strategy_return_pct": result.strategy_return_pct,
        "nifty_return_pct": result.nifty_return_pct,
        "outperformance_pct": result.outperformance_pct,
        "total_trades": result.total_trades, "net_profit": result.net_profit,
        "verdict": result.verdict, "verdict_type": result.verdict_type,
    }


@app.get("/api/watchlist")
async def get_watchlist():
    state = get_state()
    growth = state.growth_state or await get_growth_state()
    return {
        "tier": growth.current_tier.value,
        "total": len(state.watchlist_scores),
        "stocks": [
            {
                "symbol": s.symbol, "sector": s.sector,
                "composite": s.composite, "grade": s.grade.value,
                "ltp": s.ltp, "rsi": s.rsi, "volume_ratio": s.volume_ratio,
            }
            for s in state.watchlist_scores[:30]
        ],
    }


@app.get("/api/growth")
async def get_growth():
    growth = await get_growth_state()
    return {
        "current_capital": growth.current_capital,
        "current_tier": growth.current_tier.value,
        "next_tier_threshold": growth.next_tier_threshold,
        "progress_pct_to_next_tier": growth.progress_pct_to_next_tier,
        "days_to_next_tier_at_current_rate": growth.days_to_next_tier_at_current_rate,
        "peak_capital": growth.peak_capital,
        "drawdown_from_peak_pct": growth.drawdown_from_peak_pct,
        "capital_last_confirmed": growth.capital_last_confirmed,
        "is_proven": growth.is_proven,
    }


@app.get("/api/news")
async def get_news():
    """Market news feed — simple summaries from Moneycontrol & ET."""
    news_state = await fetch_market_news()
    return {
        "mood": news_state.overall_mood,
        "mood_score": news_state.mood_score,
        "count": len(news_state.items),
        "last_fetched": news_state.last_fetched.isoformat() if news_state.last_fetched else None,
        "items": [
            {
                "title": item.title,
                "summary": item.summary,
                "source": item.source,
                "sentiment": item.sentiment,
                "impact": item.impact,
                "published": item.published,
            }
            for item in news_state.items
        ],
    }


@app.get("/api/opportunity-archive")
async def get_opportunity_archive():
    """Engine 23 hypothetical skip analysis. Top-level key: hypothetical=true."""
    if not ENABLE_ENGINE23_ARCHIVE:
        return {"hypothetical": True, "status": "disabled", "entries": []}
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute(
            "SELECT * FROM opportunity_archive WHERE date >= date('now', '-7 days') ORDER BY date DESC LIMIT 50"
        )
        entries = []
        async for row in rows:
            entries.append({
                "date": row["date"], "ticker": row["ticker"],
                "reason": row["rejection_reason"],
                "move_pct": row["hypothetical_move_pct"],
                "classification": row["classification"],
            })
        return {"hypothetical": True, "entries": entries, "count": len(entries)}


@app.post("/api/settings")
async def update_settings(request: SettingsUpdate):
    """Update a setting (with audit log). CANNOT override proven/risk floor."""
    FORBIDDEN = {"is_proven", "max_risk_pct", "risk_pct", "proven",
                 "is_proven_tier_a", "is_proven_tier_b",
                 "is_proven_tier_c", "is_proven_tier_d"}
    if request.setting_name.lower().replace(" ", "_") in FORBIDDEN:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Cannot override '{request.setting_name}' via settings. "
                "is_proven is controlled exclusively by Engine 24's validation."
            ),
        )
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute(
            "INSERT INTO settings_log (timestamp, setting_name, old_value, new_value, reason) "
            "VALUES (?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), request.setting_name, "", request.new_value, request.reason),
        )
        await db.commit()
    return {"status": "updated", "setting": request.setting_name, "value": request.new_value}


class CapitalUpdate(BaseModel):
    capital: float = Field(..., ge=1000, le=20000)


@app.post("/api/capital")
async def set_capital(request: CapitalUpdate):
    """Set current trading capital. Tier adjusts automatically."""
    from tradepilot.layer2.engine21_growth import update_capital, get_growth_state
    from tradepilot.database import get_db

    old_growth = await get_growth_state()
    old_capital = old_growth.current_capital

    await update_capital(request.capital)
    new_growth = await get_growth_state()

    # Audit log
    async with get_db() as db:
        await db.execute(
            "INSERT INTO settings_log (timestamp, setting_name, old_value, new_value, reason) "
            "VALUES (?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), "current_capital",
             str(old_capital), str(request.capital), "Manual capital update from UI"),
        )
        await db.commit()

    logger.info("Capital updated via UI: ₹%.2f → ₹%.2f (Tier %s)",
                old_capital, request.capital, new_growth.current_tier.value)

    return {
        "status": "updated",
        "old_capital": old_capital,
        "new_capital": request.capital,
        "new_tier": new_growth.current_tier.value,
        "progress_pct": new_growth.progress_pct_to_next_tier,
    }


# === DEBUG/DEV ENDPOINTS (rate-limited, not in original spec) ===

_last_scan_trigger: float = 0.0
_last_monitor_trigger: float = 0.0
_MIN_SCAN_INTERVAL_SEC = 60
_MIN_MONITOR_INTERVAL_SEC = 30
DEBUG_ENDPOINTS_ENABLED = True  # Set False for production


@app.post("/api/scan")
async def trigger_scan():
    """DEV ONLY. Rate-limited to 1/60s. Respects Engine 11 gate."""
    global _last_scan_trigger
    if not DEBUG_ENDPOINTS_ENABLED:
        raise HTTPException(status_code=404, detail="Debug endpoints disabled")
    now = time.time()
    if now - _last_scan_trigger < _MIN_SCAN_INTERVAL_SEC:
        raise HTTPException(status_code=429, detail="Rate limited — retry later")
    _last_scan_trigger = now
    await run_live_pipeline()
    state = get_state()
    return {
        "status": "scan_complete",
        "signals_found": len(state.signals),
        "risk_gate": state.risk_state.gate.value if state.risk_state else "GO",
    }


@app.post("/api/monitor")
async def trigger_monitor():
    """DEV ONLY. Rate-limited to 1/30s."""
    global _last_monitor_trigger
    if not DEBUG_ENDPOINTS_ENABLED:
        raise HTTPException(status_code=404, detail="Debug endpoints disabled")
    now = time.time()
    if now - _last_monitor_trigger < _MIN_MONITOR_INTERVAL_SEC:
        raise HTTPException(status_code=429, detail="Rate limited — retry later")
    _last_monitor_trigger = now
    await run_position_monitor()
    state = get_state()
    return {
        "active_trade": state.active_trade.ticker if state.active_trade else None,
        "exit_signal": state.exit_signal.urgency if state.exit_signal else None,
    }


@app.get("/api/debug/data-check")
async def debug_data_check():
    """Diagnose Yahoo Finance connectivity. Tests LTP + candles for 3 stocks."""
    if not DEBUG_ENDPOINTS_ENABLED:
        raise HTTPException(status_code=404, detail="Debug endpoints disabled")

    import traceback
    import asyncio
    from tradepilot.layer1.yahoo_provider import YahooFinanceProvider
    from datetime import timedelta

    provider = YahooFinanceProvider()
    test_symbols = ["RELIANCE", "TCS", "SBIN"]
    results = {}

    for sym in test_symbols:
        result = {"ltp": None, "ltp_error": None, "candles_5m": None, "candles_1d": None, "candle_error": None}
        # Test LTP (with 12s timeout)
        try:
            ltp = await asyncio.wait_for(provider.get_ltp(sym), timeout=12)
            result["ltp"] = ltp
        except asyncio.TimeoutError:
            result["ltp_error"] = "TIMEOUT after 12s"
        except Exception as e:
            result["ltp_error"] = f"{type(e).__name__}: {str(e)[:100]}"

        # Test 5m candles (with 12s timeout)
        try:
            now = datetime.now()
            candles = await asyncio.wait_for(
                provider.get_candles(sym, "5m", from_dt=now - timedelta(days=5), to_dt=now),
                timeout=12,
            )
            result["candles_5m"] = {"rows": len(candles), "columns": list(candles.columns) if not candles.empty else []}
            if not candles.empty:
                result["candles_5m"]["last_close"] = float(candles["close"].iloc[-1])
        except asyncio.TimeoutError:
            result["candle_error"] = "TIMEOUT after 12s"
        except Exception as e:
            result["candle_error"] = f"{type(e).__name__}: {str(e)[:150]}"

        # Test 1d candles (with 12s timeout)
        try:
            now = datetime.now()
            candles_1d = await asyncio.wait_for(
                provider.get_candles(sym, "1d", from_dt=now - timedelta(days=30), to_dt=now),
                timeout=12,
            )
            result["candles_1d"] = {"rows": len(candles_1d), "columns": list(candles_1d.columns) if not candles_1d.empty else []}
            if not candles_1d.empty:
                result["candles_1d"]["last_close"] = float(candles_1d["close"].iloc[-1])
        except asyncio.TimeoutError:
            result["candles_1d_error"] = "TIMEOUT after 12s"
        except Exception as e:
            result["candles_1d_error"] = f"{type(e).__name__}: {str(e)[:100]}"

        results[sym] = result

    # Also test VIX
    try:
        vix = await asyncio.wait_for(provider.get_vix(), timeout=12)
        results["_vix"] = vix
    except asyncio.TimeoutError:
        results["_vix_error"] = "TIMEOUT after 12s"
    except Exception as e:
        results["_vix_error"] = str(e)[:100]

    return results
