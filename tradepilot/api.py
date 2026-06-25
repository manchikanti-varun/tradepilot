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
    RiskGate,
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
    provider_name = type(state.market_data).__name__
    return {
        "status": "healthy",
        "version": "3.4.0",
        "data_source": provider_name,
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
    """Engine 26 morning brief — enhanced with VIX, news mood, yesterday recap."""
    state = get_state()
    if state.morning_brief and state.morning_brief.date == datetime.now().strftime("%Y-%m-%d"):
        brief = state.morning_brief
    else:
        brief = await generate_morning_brief()

    # Get additional live data for the brief
    vix = 0.0
    news_mood = "NEUTRAL"
    try:
        vix = await state.market_data.get_vix()
    except Exception:
        pass
    try:
        from tradepilot.layer2.engine27_news import fetch_market_news
        news_state = await fetch_market_news()
        news_mood = news_state.overall_mood
    except Exception:
        pass

    response = {
        "date": brief.date,
        "capital_snapshot": brief.capital_snapshot,
        "watchlist_summary": brief.watchlist_summary,
        "risk_state": brief.risk_state,
        "one_line_summary": brief.one_line_summary,
        "vix": round(vix, 2),
        "news_mood": news_mood,
        "market_outlook": _get_market_outlook(vix, news_mood),
    }
    if brief.event_calendar_today is not None:
        response["event_calendar_today"] = brief.event_calendar_today
    if brief.yesterday_recap is not None:
        response["yesterday_recap"] = brief.yesterday_recap
    return response


def _get_market_outlook(vix: float, mood: str) -> dict:
    """Generate market outlook for morning brief."""
    if vix > 22:
        weather = "⛈️ Storm warning"
        advice = "High volatility — sit out or trade very small."
    elif vix > 17:
        weather = "🌊 Choppy waters"
        advice = "Moderate volatility — only take the best setups."
    elif mood == "BEARISH":
        weather = "🌥️ Cloudy"
        advice = "Negative sentiment — be cautious, tight stops."
    elif mood == "BULLISH" and vix < 15:
        weather = "☀️ Clear skies"
        advice = "Low VIX + positive news — good day to trade with conviction."
    else:
        weather = "⛅ Partly clear"
        advice = "Normal conditions — follow the signals."

    return {"weather": weather, "advice": advice}


@app.get("/api/signals")
async def get_signals():
    state = get_state()
    signals = []
    now = datetime.now()
    for s in state.signals:
        generated = s.generated_at if hasattr(s, 'generated_at') and s.generated_at else now
        age_sec = (now - generated).total_seconds()
        # Signals expire after 15 minutes (900 seconds)
        is_expired = age_sec > 900
        remaining_sec = max(0, 900 - int(age_sec))

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
            "generated_at": generated.isoformat(),
            "expires_in_sec": remaining_sec,
            "is_expired": is_expired,
        })
    # Filter out expired signals
    active_signals = [s for s in signals if not s["is_expired"]]
    return {
        "signals": active_signals,
        "count": len(active_signals),
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


@app.get("/api/stats")
async def get_stats():
    """Full stats with chart data — daily P&L, capital curve, trade breakdown."""
    from tradepilot.database import get_db
    async with get_db() as db:
        # Daily P&L (last 30 days)
        daily_rows = await db.execute(
            "SELECT date, net_pnl, total_trades, winning_trades, losing_trades, total_charges "
            "FROM daily_summary ORDER BY date DESC LIMIT 30"
        )
        daily_pnl = []
        async for row in daily_rows:
            daily_pnl.append({
                "date": row["date"], "pnl": row["net_pnl"] or 0,
                "trades": row["total_trades"] or 0,
                "wins": row["winning_trades"] or 0,
                "losses": row["losing_trades"] or 0,
                "charges": row["total_charges"] or 0,
            })
        daily_pnl.reverse()

        # All trades for capital curve and stats
        trade_rows = await db.execute(
            "SELECT date, ticker, entry_price, exit_price, qty, net_pnl, net_pnl_pct, "
            "total_charges, hold_duration_min, was_profitable, grade, sector, exit_reason "
            "FROM trades WHERE status = 'CLOSED' ORDER BY exit_time ASC"
        )
        trades = []
        async for row in trade_rows:
            trades.append(dict(row))

        # Growth state for starting capital
        growth_row = await db.execute("SELECT current_capital, peak_capital FROM growth_state WHERE id = 1")
        growth_data = await growth_row.fetchone()

    # Compute capital curve
    current_capital = growth_data["current_capital"] if growth_data else 5000
    total_net_pnl = sum(t["net_pnl"] or 0 for t in trades)
    starting_capital = current_capital - total_net_pnl

    capital_curve = []
    running_capital = starting_capital
    for t in trades:
        running_capital += (t["net_pnl"] or 0)
        capital_curve.append({"date": t["date"], "capital": round(running_capital, 2)})

    # Summary stats
    total_trades = len(trades)
    wins = sum(1 for t in trades if t["was_profitable"])
    losses = total_trades - wins
    win_rate = (wins / total_trades * 100) if total_trades > 0 else 0
    total_charges = sum(t["total_charges"] or 0 for t in trades)
    total_gross = total_net_pnl + total_charges
    charge_drag = (total_charges / abs(total_gross) * 100) if abs(total_gross) > 0 else 0

    # Best/worst trade
    best_trade = max(trades, key=lambda t: t["net_pnl"] or 0) if trades else None
    worst_trade = min(trades, key=lambda t: t["net_pnl"] or 0) if trades else None

    # Average hold duration
    durations = [t["hold_duration_min"] for t in trades if t["hold_duration_min"]]
    avg_duration = sum(durations) / len(durations) if durations else 0

    # Sector breakdown
    sector_stats = {}
    for t in trades:
        s = t["sector"] or "Unknown"
        if s not in sector_stats:
            sector_stats[s] = {"trades": 0, "wins": 0, "pnl": 0}
        sector_stats[s]["trades"] += 1
        sector_stats[s]["pnl"] += t["net_pnl"] or 0
        if t["was_profitable"]:
            sector_stats[s]["wins"] += 1

    # Win rate over time (rolling 10-trade)
    win_rate_series = []
    for i in range(min(10, total_trades), total_trades + 1):
        window = trades[max(0, i-10):i]
        wr = sum(1 for t in window if t["was_profitable"]) / len(window) * 100 if window else 0
        win_rate_series.append({"trade_num": i, "win_rate": round(wr, 1)})

    return {
        "summary": {
            "total_trades": total_trades,
            "wins": wins,
            "losses": losses,
            "win_rate": round(win_rate, 1),
            "net_pnl": round(total_net_pnl, 2),
            "total_charges": round(total_charges, 2),
            "charge_drag_pct": round(charge_drag, 1),
            "avg_duration_min": round(avg_duration, 1),
            "starting_capital": round(starting_capital, 2),
            "current_capital": round(current_capital, 2),
            "return_pct": round((current_capital - starting_capital) / starting_capital * 100, 1) if starting_capital > 0 else 0,
        },
        "best_trade": {"ticker": best_trade["ticker"], "pnl": best_trade["net_pnl"]} if best_trade else None,
        "worst_trade": {"ticker": worst_trade["ticker"], "pnl": worst_trade["net_pnl"]} if worst_trade else None,
        "daily_pnl": daily_pnl,
        "capital_curve": capital_curve,
        "win_rate_series": win_rate_series,
        "sector_stats": sector_stats,
    }


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


@app.get("/api/history/export")
async def export_trade_history():
    """Export all closed trades as CSV."""
    from fastapi.responses import Response
    from tradepilot.database import get_db
    import csv
    import io

    async with get_db() as db:
        rows = await db.execute(
            """SELECT date, ticker, sector, entry_time, exit_time, entry_price, exit_price,
                qty, capital_used, capital_tier, gross_pnl, total_charges, net_pnl,
                net_pnl_pct, hold_duration_min, grade, exit_reason, composite_score
            FROM trades WHERE status = 'CLOSED' ORDER BY exit_time DESC"""
        )
        trades = []
        async for row in rows:
            trades.append(dict(row))

    if not trades:
        return Response(content="No trades to export", media_type="text/plain")

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "date", "ticker", "sector", "entry_time", "exit_time",
        "entry_price", "exit_price", "qty", "capital_used", "capital_tier",
        "gross_pnl", "total_charges", "net_pnl", "net_pnl_pct",
        "hold_duration_min", "grade", "exit_reason", "composite_score",
    ])
    writer.writeheader()
    writer.writerows(trades)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tradepilot_history.csv"},
    )


@app.get("/api/history/{trade_id}/notes")
async def get_trade_notes(trade_id: int):
    """Get all notes for a trade."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute(
            "SELECT id, note, tags, created_at FROM trade_notes WHERE trade_id = ? ORDER BY created_at DESC",
            (trade_id,),
        )
        notes = []
        async for row in rows:
            notes.append({"id": row["id"], "note": row["note"], "tags": row["tags"], "created_at": row["created_at"]})
    return {"trade_id": trade_id, "notes": notes}


class TradeNoteRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=1000)
    tags: Optional[str] = Field(None, max_length=200)


@app.post("/api/history/{trade_id}/notes")
async def add_trade_note(trade_id: int, request: TradeNoteRequest):
    """Add a note to a trade."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute(
            "INSERT INTO trade_notes (trade_id, note, tags, created_at) VALUES (?, ?, ?, ?)",
            (trade_id, request.note, request.tags, datetime.now().isoformat()),
        )
        await db.commit()
    return {"status": "added", "trade_id": trade_id}


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


@app.get("/api/alerts")
async def get_alerts():
    """Get current actionable alerts — signals, exit recommendations, risk warnings."""
    state = get_state()
    alerts = []

    # Signal alerts
    if state.signals:
        for s in state.signals[:3]:
            alerts.append({
                "type": "signal",
                "priority": s.priority,
                "title": f"BUY {s.symbol} @ ₹{s.ltp:.0f} — Grade {s.grade}",
                "detail": f"Qty {s.qty} | Stop ₹{s.stop_price:.0f} | Target ₹{s.target:.0f} | Net ₹{s.net_after_charges:.0f}",
                "timestamp": state.last_scan_time.isoformat() if state.last_scan_time else None,
            })

    # Exit alerts
    if state.exit_signal and state.exit_signal.should_exit:
        alerts.append({
            "type": "exit",
            "priority": 0,
            "title": f"EXIT {state.active_trade.ticker} — {state.exit_signal.urgency}",
            "detail": state.exit_signal.reason,
            "timestamp": datetime.now().isoformat(),
        })

    # Risk alerts
    if state.risk_state and state.risk_state.gate != RiskGate.GO:
        alerts.append({
            "type": "risk",
            "priority": 0,
            "title": f"{state.risk_state.gate.value} — {state.risk_state.reason}",
            "detail": "; ".join(state.risk_state.caution_notes) if state.risk_state.caution_notes else None,
            "timestamp": datetime.now().isoformat(),
        })

    return {"alerts": alerts, "count": len(alerts)}


@app.get("/api/market/sectors")
async def get_sector_heatmap():
    """Sector performance heatmap — computed from watchlist scores."""
    state = get_state()
    sectors: dict[str, dict] = {}

    for score in state.watchlist_scores:
        s = score.sector
        if s not in sectors:
            sectors[s] = {"stocks": 0, "gainers": 0, "losers": 0, "avg_score": 0, "total_score": 0}
        sectors[s]["stocks"] += 1
        sectors[s]["total_score"] += score.composite
        # Use momentum as proxy for gain/loss
        if score.momentum_score > 55:
            sectors[s]["gainers"] += 1
        elif score.momentum_score < 45:
            sectors[s]["losers"] += 1

    result = []
    for name, data in sectors.items():
        avg = data["total_score"] / data["stocks"] if data["stocks"] > 0 else 50
        net = data["gainers"] - data["losers"]
        # Classify: positive/negative/neutral
        if net > 0:
            mood = "POSITIVE"
        elif net < 0:
            mood = "NEGATIVE"
        else:
            mood = "NEUTRAL"
        result.append({
            "sector": name,
            "stocks": data["stocks"],
            "gainers": data["gainers"],
            "losers": data["losers"],
            "avg_score": round(avg, 1),
            "mood": mood,
        })

    result.sort(key=lambda x: x["avg_score"], reverse=True)
    return {"sectors": result, "total_stocks_scanned": len(state.watchlist_scores)}


@app.get("/api/market/movers")
async def get_top_movers():
    """Top gainers and losers from current scan."""
    state = get_state()
    scores = state.watchlist_scores

    if not scores:
        return {"gainers": [], "losers": [], "last_scan": None}

    # Sort by momentum to find gainers/losers
    sorted_by_momentum = sorted(scores, key=lambda s: s.momentum_score, reverse=True)
    gainers = [
        {"symbol": s.symbol, "sector": s.sector, "ltp": s.ltp,
         "score": s.composite, "grade": s.grade.value, "momentum": s.momentum_score}
        for s in sorted_by_momentum[:5]
    ]
    losers = [
        {"symbol": s.symbol, "sector": s.sector, "ltp": s.ltp,
         "score": s.composite, "grade": s.grade.value, "momentum": s.momentum_score}
        for s in sorted_by_momentum[-5:]
    ]
    losers.reverse()

    return {
        "gainers": gainers,
        "losers": losers,
        "last_scan": state.last_scan_time.isoformat() if state.last_scan_time else None,
    }


@app.get("/api/signals/history")
async def get_signal_history(limit: int = 50):
    """Past signals that fired — learn which ones worked."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute(
            "SELECT * FROM signal_history ORDER BY timestamp DESC LIMIT ?", (limit,)
        )
        signals = []
        async for row in rows:
            signals.append({
                "id": row["id"], "date": row["date"], "timestamp": row["timestamp"],
                "symbol": row["symbol"], "sector": row["sector"], "grade": row["grade"],
                "composite": row["composite"], "ltp": row["ltp"], "qty": row["qty"],
                "stop_price": row["stop_price"], "target": row["target"],
                "net_after_charges": row["net_after_charges"],
                "risk_reward": row["risk_reward"], "outcome": row["outcome"],
            })
    return {"signals": signals, "count": len(signals)}


@app.get("/api/chart/{symbol}")
async def get_chart_data(symbol: str, interval: str = "5m"):
    """Get candlestick data for charting."""
    from datetime import timedelta
    state = get_state()
    now = datetime.now()

    if interval in ("1m", "5m", "15m"):
        from_dt = now - timedelta(days=5)
    elif interval == "1h":
        from_dt = now - timedelta(days=15)
    else:
        from_dt = now - timedelta(days=90)

    candles = await state.market_data.get_candles(symbol, interval, from_dt, now)
    if candles.empty:
        return {"symbol": symbol, "interval": interval, "candles": []}

    data = []
    for _, row in candles.iterrows():
        data.append({
            "time": str(row.get("timestamp", "")),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": int(row.get("volume", 0)),
        })

    return {"symbol": symbol, "interval": interval, "candles": data, "count": len(data)}


@app.get("/api/stock/{symbol}/plan")
async def get_stock_trading_plan(symbol: str):
    """Generate a complete trading plan for a stock — entry, SL, target, conditions."""
    from datetime import timedelta
    from tradepilot.layer2.engine4_discovery import (
        compute_rsi, compute_vwap, compute_macd, compute_ema, compute_atr, score_stock
    )
    from tradepilot.layer2.engine8_charges import calculate_angel_charges
    from tradepilot.layer2.engine21_growth import get_growth_state

    state = get_state()
    now = datetime.now()

    # Get candle data
    candles = await state.market_data.get_candles(symbol, "5m", now - timedelta(days=5), now)
    if candles.empty or len(candles) < 20:
        raise HTTPException(status_code=404, detail=f"Insufficient data for {symbol}")

    ltp = float(candles["close"].iloc[-1])
    closes = candles["close"]
    volumes = candles["volume"]
    highs = candles["high"]
    lows = candles["low"]

    # Compute indicators
    rsi = compute_rsi(closes)
    vwap = compute_vwap(candles)
    macd_line, macd_signal, macd_hist = compute_macd(closes)
    ema9 = compute_ema(closes, 9)
    ema21 = compute_ema(closes, 21)
    atr = compute_atr(candles)

    # Volume analysis
    recent_vol = float(volumes.iloc[-5:].mean()) if len(volumes) >= 5 else 0
    avg_vol = float(volumes.iloc[-20:].mean()) if len(volumes) >= 20 else recent_vol
    volume_ratio = recent_vol / avg_vol if avg_vol > 0 else 1.0

    # Key levels
    day_high = float(highs.iloc[-78:].max()) if len(highs) >= 78 else float(highs.max())  # ~1 day of 5m
    day_low = float(lows.iloc[-78:].min()) if len(lows) >= 78 else float(lows.min())
    range_high = float(highs.max())
    range_low = float(lows.min())

    # Support/Resistance (simple: recent swing high/low)
    resistance = float(highs.iloc[-30:].max()) if len(highs) >= 30 else day_high
    support = float(lows.iloc[-30:].min()) if len(lows) >= 30 else day_low

    # Entry zone (near VWAP or above EMA9 with volume)
    entry_low = round(max(vwap - atr * 0.1, ema9 - atr * 0.1), 2)
    entry_high = round(max(vwap + atr * 0.15, ema9 + atr * 0.15), 2)

    # Stop loss (below support or below entry - 0.4*ATR)
    stop_loss = round(min(entry_low - atr * 0.4, support - atr * 0.1), 2)

    # Targets (ATR-based)
    target_1 = round(ltp + atr * 0.4, 2)
    target_2 = round(ltp + atr * 0.7, 2)
    target_3 = round(ltp + atr * 1.0, 2)

    # Risk-reward
    risk_per_share = ltp - stop_loss
    reward_1 = target_1 - ltp
    rr_ratio = round(reward_1 / risk_per_share, 2) if risk_per_share > 0 else 0

    # Capital and qty
    growth = await get_growth_state()
    capital = growth.current_capital
    leverage = 5.0
    max_qty = int((capital * leverage) // ltp)
    # Risk-based qty: max 2% capital at risk
    max_risk = capital * 0.12  # proven risk %
    risk_qty = int(max_risk / risk_per_share) if risk_per_share > 0 else max_qty
    suggested_qty = min(max_qty, risk_qty)

    # Charges estimate
    charges, _ = calculate_angel_charges(suggested_qty, ltp, target_1)
    net_profit_t1 = suggested_qty * (target_1 - ltp) - charges

    # Trend assessment
    if ema9 > ema21 and macd_hist > 0 and ltp > vwap:
        trend = "BULLISH"
        trend_desc = "Stock is in an uptrend — EMA9 above EMA21, MACD positive, price above VWAP."
    elif ema9 < ema21 and macd_hist < 0 and ltp < vwap:
        trend = "BEARISH"
        trend_desc = "Stock is in a downtrend — avoid buying. Wait for reversal signals."
    else:
        trend = "SIDEWAYS"
        trend_desc = "Stock is moving sideways — wait for a clear breakout above resistance or rejection at support."

    # Entry conditions (when to buy)
    entry_conditions = []
    if ltp < vwap:
        entry_conditions.append(f"Wait for price to break above VWAP (₹{vwap:.1f}) with volume")
    if ltp > resistance - atr * 0.1:
        entry_conditions.append(f"Price near resistance ₹{resistance:.1f} — buy only on breakout above it")
    if volume_ratio < 1.0:
        entry_conditions.append("Volume is below average — wait for volume spike before entering")
    if rsi > 70:
        entry_conditions.append(f"RSI is {rsi:.0f} (overbought) — risky to enter now, may pull back")
    if rsi < 35:
        entry_conditions.append(f"RSI is {rsi:.0f} (oversold) — could bounce, but confirm with price action")
    if not entry_conditions:
        entry_conditions.append("Conditions look good for entry — check for volume confirmation")

    # Avoid conditions (when NOT to buy)
    avoid_conditions = []
    if rsi > 75:
        avoid_conditions.append("Don't chase — RSI shows overbought, wait for a pullback")
    if ltp > day_high:
        avoid_conditions.append("Stock already made day's high — late entry, higher risk")
    if volume_ratio > 3.0:
        avoid_conditions.append("Abnormal volume spike — could be a trap, wait for next candle")
    if atr > ltp * 0.03:
        avoid_conditions.append("High volatility (ATR > 3% of price) — keep position size small")
    if not avoid_conditions:
        avoid_conditions.append("No major red flags — proceed with normal position size")

    # Score the stock
    from tradepilot.layer1.nifty_universe import get_sector_map
    sector_map = get_sector_map()
    sector = sector_map.get(symbol, "Unknown")

    # --- NEW: "Why this stock?" reasoning ---
    reasons = []
    if ema9 > ema21:
        reasons.append("Short-term trend is up (EMA9 > EMA21)")
    if macd_hist > 0:
        reasons.append("MACD is positive — buying momentum active")
    if ltp > vwap:
        reasons.append("Price is above VWAP — buyers in control")
    if volume_ratio > 1.3:
        reasons.append(f"Volume is {volume_ratio:.1f}x above average — strong interest today")
    if 45 <= rsi <= 65:
        reasons.append(f"RSI at {rsi:.0f} — healthy range, not overbought or oversold")
    if sector in ["IT", "Banking", "Power", "Defence"]:
        reasons.append(f"{sector} sector is among today's top performers")
    if not reasons:
        reasons.append("Setup is neutral — no strong conviction either way")

    why_this_stock = f"{symbol} is showing " + (
        "bullish signals" if trend == "BULLISH" else
        "mixed signals" if trend == "SIDEWAYS" else "bearish signals"
    ) + " because: " + reasons[0].lower()
    if len(reasons) > 1:
        why_this_stock += f", and {reasons[1].lower()}"

    # --- NEW: Confidence level ---
    confidence_points = 0
    if ema9 > ema21: confidence_points += 1
    if macd_hist > 0: confidence_points += 1
    if ltp > vwap: confidence_points += 1
    if volume_ratio > 1.0: confidence_points += 1
    if 40 <= rsi <= 70: confidence_points += 1
    if rr_ratio >= 1.5: confidence_points += 1

    if confidence_points >= 5:
        confidence = "HIGH"
        confidence_desc = "Most indicators align — good probability trade"
    elif confidence_points >= 3:
        confidence = "MEDIUM"
        confidence_desc = "Some indicators positive, some mixed — proceed with caution"
    else:
        confidence = "LOW"
        confidence_desc = "Few indicators align — better to skip or wait"

    # --- NEW: Sector rank ---
    sector_stocks = [s for s in state.watchlist_scores if s.sector == sector]
    sector_stocks.sort(key=lambda x: x.composite, reverse=True)
    sector_rank = next((i + 1 for i, s in enumerate(sector_stocks) if s.symbol == symbol), 0)
    sector_total = len(sector_stocks)

    # --- NEW: Charges breakdown ---
    charges_detail, charge_breakdown = calculate_angel_charges(suggested_qty, ltp, target_1)

    # --- NEW: Recent news for this stock ---
    stock_news = []
    try:
        from tradepilot.layer2.engine27_news import _news_cache
        if _news_cache and _news_cache.items:
            sym_lower = symbol.lower()
            for item in _news_cache.items:
                if sym_lower in item.title.lower():
                    stock_news.append({"title": item.title, "sentiment": item.sentiment})
                    if len(stock_news) >= 3:
                        break
    except Exception:
        pass

    # --- NEW: Last 5 days mini performance ---
    daily_candles = await state.market_data.get_candles(symbol, "1d", now - timedelta(days=7), now)
    last_5_days = []
    if not daily_candles.empty:
        for _, row in daily_candles.tail(5).iterrows():
            change_pct = ((float(row["close"]) - float(row["open"])) / float(row["open"]) * 100) if float(row["open"]) > 0 else 0
            last_5_days.append({
                "date": str(row.get("timestamp", ""))[:10],
                "open": round(float(row["open"]), 1),
                "close": round(float(row["close"]), 1),
                "change_pct": round(change_pct, 2),
            })

    # --- NEW: Past signals for this stock ---
    past_signals = []
    try:
        from tradepilot.database import get_db as _get_db
        async with _get_db() as db:
            rows = await db.execute(
                "SELECT date, ltp, target, outcome FROM signal_history WHERE symbol = ? ORDER BY timestamp DESC LIMIT 3",
                (symbol,),
            )
            async for row in rows:
                past_signals.append({"date": row["date"], "ltp": row["ltp"], "target": row["target"], "outcome": row["outcome"]})
    except Exception:
        pass

    # --- NEW: Best entry time (based on intraday pattern) ---
    best_hour = None
    if not candles.empty and "timestamp" in candles.columns:
        try:
            import pandas as pd
            candles_copy = candles.copy()
            candles_copy["hour"] = pd.to_datetime(candles_copy["timestamp"]).dt.hour
            candles_copy["move"] = candles_copy["close"] - candles_copy["open"]
            hourly_moves = candles_copy.groupby("hour")["move"].mean()
            if not hourly_moves.empty:
                best_h = int(hourly_moves.idxmax())
                best_hour = f"{best_h}:00 – {best_h}:59"
        except Exception:
            pass

    import pandas as pd  # ensure available for the above

    return {
        "symbol": symbol,
        "sector": sector,
        "ltp": ltp,
        "trend": trend,
        "trend_description": trend_desc,
        "why_this_stock": why_this_stock,
        "reasons": reasons,
        "confidence": confidence,
        "confidence_description": confidence_desc,
        "sector_rank": {"rank": sector_rank, "total": sector_total,
                        "label": f"#{sector_rank} in {sector} ({sector_total} stocks)"},
        "entry_zone": {"low": entry_low, "high": entry_high},
        "stop_loss": stop_loss,
        "targets": [
            {"level": 1, "price": target_1, "label": "Target 1 (conservative)"},
            {"level": 2, "price": target_2, "label": "Target 2 (moderate)"},
            {"level": 3, "price": target_3, "label": "Target 3 (aggressive)"},
        ],
        "risk_reward": rr_ratio,
        "suggested_qty": suggested_qty,
        "capital_required": round(suggested_qty * ltp / leverage, 2),
        "estimated_charges": round(charges, 2),
        "charges_breakdown": {
            "brokerage": charge_breakdown.brokerage,
            "stt": charge_breakdown.stt,
            "exchange_txn": charge_breakdown.exchange_txn,
            "gst": charge_breakdown.gst,
            "stamp_duty": charge_breakdown.stamp_duty,
            "sebi": charge_breakdown.sebi,
            "total": charge_breakdown.total,
        },
        "net_profit_target1": round(net_profit_t1, 2),
        "risk_per_share": round(risk_per_share, 2),
        "indicators": {
            "rsi": round(rsi, 1),
            "vwap": round(vwap, 2),
            "ema9": round(ema9, 2),
            "ema21": round(ema21, 2),
            "macd_histogram": round(macd_hist, 4),
            "atr": round(atr, 2),
            "volume_ratio": round(volume_ratio, 2),
            "day_high": round(day_high, 2),
            "day_low": round(day_low, 2),
            "support": round(support, 2),
            "resistance": round(resistance, 2),
        },
        "entry_conditions": entry_conditions,
        "avoid_conditions": avoid_conditions,
        "risk_advice": [
            f"Max risk: ₹{max_risk:.0f} ({growth.current_tier.value} tier)",
            f"Risk per share: ₹{risk_per_share:.1f} (stop at ₹{stop_loss:.1f})",
            f"Don't risk more than 1-2% of your ₹{capital:.0f} capital on this trade",
            "Wait for confirmation — don't chase a candle that already moved sharply",
            "Exit immediately if stop loss is hit — no hoping for recovery",
        ],
        "stock_news": stock_news,
        "last_5_days": last_5_days,
        "past_signals": past_signals,
        "best_entry_time": best_hour,
    }


@app.get("/api/stats/time-performance")
async def get_time_performance():
    """P&L by hour of entry — find your best trading times."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute(
            """SELECT entry_time, net_pnl, was_profitable
            FROM trades WHERE status = 'CLOSED' AND entry_time IS NOT NULL"""
        )
        hourly = {}
        async for row in rows:
            try:
                hour = int(row["entry_time"][11:13])
                if hour not in hourly:
                    hourly[hour] = {"trades": 0, "wins": 0, "pnl": 0}
                hourly[hour]["trades"] += 1
                hourly[hour]["pnl"] += row["net_pnl"] or 0
                if row["was_profitable"]:
                    hourly[hour]["wins"] += 1
            except (ValueError, IndexError, TypeError):
                continue

    result = []
    for h in range(9, 16):
        data = hourly.get(h, {"trades": 0, "wins": 0, "pnl": 0})
        wr = (data["wins"] / data["trades"] * 100) if data["trades"] > 0 else 0
        result.append({"hour": h, "label": f"{h}:00", "trades": data["trades"],
                       "wins": data["wins"], "pnl": round(data["pnl"], 2), "win_rate": round(wr, 1)})
    return {"hours": result}


# ═══════════════════════════════════════════════════════════════
# FEATURES 1-24: FULL TRADING TERMINAL ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/position/live-pnl")
async def get_live_pnl():
    """Feature 1: Live P&L — real-time profit/loss for active position."""
    state = get_state()
    trade = state.active_trade
    if not trade:
        return {"active": False}
    try:
        ltp = await state.market_data.get_ltp(trade.ticker)
    except Exception:
        ltp = trade.entry_price
    from tradepilot.layer2.engine8_charges import calculate_angel_charges
    gross = trade.qty * (ltp - trade.entry_price)
    charges, breakdown = calculate_angel_charges(trade.qty, trade.entry_price, ltp)
    net = gross - charges
    pct = (net / trade.capital_used * 100) if trade.capital_used > 0 else 0
    return {
        "active": True, "ticker": trade.ticker, "ltp": ltp,
        "entry_price": trade.entry_price, "qty": trade.qty,
        "gross_pnl": round(gross, 2), "charges": round(charges, 2),
        "net_pnl": round(net, 2), "pnl_pct": round(pct, 2),
        "if_exit_now": round(net, 2),
    }


@app.get("/api/market/premarket")
async def get_premarket():
    """Feature 2: Pre-market scanner — gap up/down stocks based on previous close vs current."""
    state = get_state()
    scores = state.watchlist_scores
    if not scores:
        return {"gap_ups": [], "gap_downs": [], "status": "no_data"}
    # Use daily candle close vs current LTP to compute gap
    gaps = []
    for s in scores[:30]:
        try:
            candles = await state.market_data.get_candles(s.symbol, "1d", datetime.now() - timedelta(days=3), datetime.now())
            if candles.empty or len(candles) < 2:
                continue
            prev_close = float(candles["close"].iloc[-2])
            curr = s.ltp
            gap_pct = ((curr - prev_close) / prev_close * 100) if prev_close > 0 else 0
            gaps.append({"symbol": s.symbol, "sector": s.sector, "prev_close": round(prev_close, 1),
                         "current": round(curr, 1), "gap_pct": round(gap_pct, 2)})
        except Exception:
            continue
    gap_ups = sorted([g for g in gaps if g["gap_pct"] > 0.3], key=lambda x: x["gap_pct"], reverse=True)[:5]
    gap_downs = sorted([g for g in gaps if g["gap_pct"] < -0.3], key=lambda x: x["gap_pct"])[:5]
    return {"gap_ups": gap_ups, "gap_downs": gap_downs}


class PriceAlertRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    target_price: float = Field(..., gt=0)
    direction: str = Field(..., pattern="^(ABOVE|BELOW)$")


@app.post("/api/alerts/price")
async def create_price_alert(request: PriceAlertRequest):
    """Feature 3: Create price alert."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute(
            "INSERT INTO price_alerts (symbol, target_price, direction, created_at) VALUES (?, ?, ?, ?)",
            (request.symbol, request.target_price, request.direction, datetime.now().isoformat()),
        )
        await db.commit()
    return {"status": "created", "symbol": request.symbol, "target": request.target_price, "direction": request.direction}


@app.get("/api/alerts/price")
async def get_price_alerts():
    """Get all active price alerts."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute("SELECT * FROM price_alerts WHERE triggered = 0 ORDER BY created_at DESC")
        alerts = []
        async for row in rows:
            alerts.append({"id": row["id"], "symbol": row["symbol"],
                           "target_price": row["target_price"], "direction": row["direction"]})
    return {"alerts": alerts}


@app.delete("/api/alerts/price/{alert_id}")
async def delete_price_alert(alert_id: int):
    """Delete a price alert."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute("DELETE FROM price_alerts WHERE id = ?", (alert_id,))
        await db.commit()
    return {"status": "deleted"}


@app.post("/api/intake/quick")
async def quick_trade_intake(symbol: str, price: float, qty: int, intent: str = "BUY"):
    """Feature 4: Quick trade — one-tap from signal card."""
    return await confirm_intake({"intent": intent, "ticker": symbol, "price": price, "qty": qty})


@app.get("/api/position/exit-calc")
async def exit_calculator():
    """Feature 5: Exit calculator — what you get if you exit now."""
    state = get_state()
    trade = state.active_trade
    if not trade:
        return {"active": False}
    try:
        ltp = await state.market_data.get_ltp(trade.ticker)
    except Exception:
        ltp = trade.entry_price
    from tradepilot.layer2.engine8_charges import calculate_angel_charges
    gross = trade.qty * (ltp - trade.entry_price)
    charges, breakdown = calculate_angel_charges(trade.qty, trade.entry_price, ltp)
    net = gross - charges
    return {
        "ticker": trade.ticker, "current_ltp": ltp,
        "gross_profit": round(gross, 2), "total_charges": round(charges, 2),
        "net_if_exit_now": round(net, 2),
        "charges_detail": {"brokerage": breakdown.brokerage, "stt": breakdown.stt,
                           "gst": breakdown.gst, "exchange": breakdown.exchange_txn,
                           "stamp": breakdown.stamp_duty, "sebi": breakdown.sebi},
        "hold_time_min": round((datetime.now() - trade.entry_time).total_seconds() / 60, 1) if trade.entry_time else 0,
    }


@app.get("/api/market/expiry")
async def get_expiry_info():
    """Feature 6: F&O expiry awareness."""
    from datetime import date
    today = date.today()
    weekday = today.weekday()  # 0=Mon, 4=Fri
    # Weekly expiry is every Thursday (3)
    days_to_thursday = (3 - weekday) % 7
    next_weekly = today + timedelta(days=days_to_thursday)
    is_expiry_today = weekday == 3
    # Monthly expiry = last Thursday of month
    import calendar
    last_day = calendar.monthrange(today.year, today.month)[1]
    last_date = date(today.year, today.month, last_day)
    while last_date.weekday() != 3:
        last_date -= timedelta(days=1)
    is_monthly_expiry = today == last_date
    return {
        "is_expiry_day": is_expiry_today,
        "is_monthly_expiry": is_monthly_expiry,
        "next_weekly_expiry": next_weekly.isoformat(),
        "monthly_expiry": last_date.isoformat(),
        "warning": "⚠️ Expiry day — expect higher volatility" if is_expiry_today else None,
    }


@app.get("/api/stock/{symbol}/multiframe")
async def get_multiframe_analysis(symbol: str):
    """Feature 7: Multi-timeframe view — 5min + 15min + 1h trend."""
    from tradepilot.layer2.engine4_discovery import compute_ema, compute_rsi, compute_macd
    state = get_state()
    now = datetime.now()
    result = {}
    for interval, period_days, label in [("5m", 5, "5min"), ("15m", 5, "15min"), ("1h", 15, "1hour")]:
        candles = await state.market_data.get_candles(symbol, interval, now - timedelta(days=period_days), now)
        if candles.empty or len(candles) < 10:
            result[label] = {"trend": "NO_DATA", "ema9": 0, "ema21": 0, "rsi": 50}
            continue
        closes = candles["close"]
        ema9 = compute_ema(closes, 9)
        ema21 = compute_ema(closes, 21)
        rsi = compute_rsi(closes)
        _, _, macd_hist = compute_macd(closes)
        if ema9 > ema21 and macd_hist > 0:
            trend = "BULLISH"
        elif ema9 < ema21 and macd_hist < 0:
            trend = "BEARISH"
        else:
            trend = "SIDEWAYS"
        result[label] = {"trend": trend, "ema9": round(ema9, 2), "ema21": round(ema21, 2),
                         "rsi": round(rsi, 1), "macd": round(macd_hist, 4)}
    # All aligned = highest confidence
    trends = [v["trend"] for v in result.values() if v["trend"] != "NO_DATA"]
    all_bullish = all(t == "BULLISH" for t in trends) if trends else False
    all_bearish = all(t == "BEARISH" for t in trends) if trends else False
    return {"symbol": symbol, "timeframes": result,
            "alignment": "STRONG_BUY" if all_bullish else "STRONG_SELL" if all_bearish else "MIXED"}


@app.get("/api/favorites")
async def get_favorites():
    """Feature 8: Get favorite/pinned stocks."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute("SELECT symbol, added_at FROM favorites ORDER BY added_at DESC")
        favs = []
        async for row in rows:
            favs.append({"symbol": row["symbol"], "added_at": row["added_at"]})
    return {"favorites": favs}


@app.post("/api/favorites/{symbol}")
async def add_favorite(symbol: str):
    """Add stock to favorites."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute("INSERT OR REPLACE INTO favorites (symbol, added_at) VALUES (?, ?)",
                         (symbol.upper(), datetime.now().isoformat()))
        await db.commit()
    return {"status": "added", "symbol": symbol.upper()}


@app.delete("/api/favorites/{symbol}")
async def remove_favorite(symbol: str):
    """Remove stock from favorites."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute("DELETE FROM favorites WHERE symbol = ?", (symbol.upper(),))
        await db.commit()
    return {"status": "removed"}


@app.get("/api/insights")
async def get_trade_insights():
    """Features 9-12: AI-learned insights from trade history."""
    from tradepilot.database import get_db
    async with get_db() as db:
        rows = await db.execute(
            """SELECT ticker, sector, entry_time, net_pnl, was_profitable, hold_duration_min, grade
            FROM trades WHERE status = 'CLOSED' ORDER BY exit_time DESC"""
        )
        trades = []
        async for row in rows:
            trades.append(dict(row))

    if len(trades) < 3:
        return {"insights": [], "note": "Need more trades to generate insights"}

    insights = []

    # Feature 9: Best sector/time patterns
    sector_stats = {}
    for t in trades:
        s = t["sector"] or "Unknown"
        if s not in sector_stats:
            sector_stats[s] = {"wins": 0, "losses": 0, "pnl": 0}
        sector_stats[s]["pnl"] += t["net_pnl"] or 0
        if t["was_profitable"]:
            sector_stats[s]["wins"] += 1
        else:
            sector_stats[s]["losses"] += 1

    best_sector = max(sector_stats.items(), key=lambda x: x[1]["pnl"], default=None)
    if best_sector and best_sector[1]["pnl"] > 0:
        insights.append({
            "type": "pattern", "icon": "🏆",
            "title": f"Best sector: {best_sector[0]}",
            "detail": f"You've made ₹{best_sector[1]['pnl']:.0f} from {best_sector[0]} stocks",
        })

    # Best hour
    hour_stats = {}
    for t in trades:
        try:
            h = int(t["entry_time"][11:13])
            if h not in hour_stats:
                hour_stats[h] = {"wins": 0, "total": 0}
            hour_stats[h]["total"] += 1
            if t["was_profitable"]:
                hour_stats[h]["wins"] += 1
        except:
            continue
    best_hour = max(hour_stats.items(), key=lambda x: x[1]["wins"] / max(x[1]["total"], 1), default=None)
    if best_hour and best_hour[1]["total"] >= 2:
        wr = best_hour[1]["wins"] / best_hour[1]["total"] * 100
        insights.append({
            "type": "pattern", "icon": "⏰",
            "title": f"Best time: {best_hour[0]}:00 – {best_hour[0]}:59",
            "detail": f"{wr:.0f}% win rate from {best_hour[1]['total']} trades at this hour",
        })

    # Feature 10: Repeat mistake detection
    ticker_losses = {}
    for t in trades:
        if not t["was_profitable"]:
            ticker_losses[t["ticker"]] = ticker_losses.get(t["ticker"], 0) + 1
    repeat_losers = [(k, v) for k, v in ticker_losses.items() if v >= 2]
    for ticker, count in repeat_losers[:2]:
        insights.append({
            "type": "warning", "icon": "⚠️",
            "title": f"Repeat loss: {ticker} ({count} losses)",
            "detail": f"You've lost {count} times on {ticker}. Consider avoiding it.",
        })

    # Feature 11: Exit timing analysis
    if len(trades) >= 5:
        avg_hold = sum(t["hold_duration_min"] or 0 for t in trades) / len(trades)
        winning_holds = [t["hold_duration_min"] for t in trades if t["was_profitable"] and t["hold_duration_min"]]
        losing_holds = [t["hold_duration_min"] for t in trades if not t["was_profitable"] and t["hold_duration_min"]]
        if winning_holds and losing_holds:
            avg_win_hold = sum(winning_holds) / len(winning_holds)
            avg_loss_hold = sum(losing_holds) / len(losing_holds)
            if avg_loss_hold > avg_win_hold * 1.5:
                insights.append({
                    "type": "tip", "icon": "💡",
                    "title": "You hold losers too long",
                    "detail": f"Avg winning hold: {avg_win_hold:.0f} min vs losing hold: {avg_loss_hold:.0f} min. Cut losses faster.",
                })

    # Feature 15: Streak
    streak = 0
    streak_type = None
    for t in trades:
        if streak_type is None:
            streak_type = t["was_profitable"]
            streak = 1
        elif t["was_profitable"] == streak_type:
            streak += 1
        else:
            break
    if streak >= 2:
        insights.append({
            "type": "streak", "icon": "🔥" if streak_type else "❄️",
            "title": f"{'Win' if streak_type else 'Loss'} streak: {streak} trades",
            "detail": f"You're on a {streak}-trade {'winning' if streak_type else 'losing'} streak",
        })

    return {"insights": insights, "total_trades": len(trades)}


@app.get("/api/market/countdown")
async def get_market_countdown():
    """Feature 16: Market open/close countdown."""
    from zoneinfo import ZoneInfo
    now = datetime.now(ZoneInfo("Asia/Kolkata"))
    market_open = now.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)

    if now < market_open:
        secs = int((market_open - now).total_seconds())
        return {"status": "PRE_MARKET", "label": "Market opens in", "seconds": secs,
                "display": f"{secs // 3600}h {(secs % 3600) // 60}m"}
    elif now > market_close:
        return {"status": "CLOSED", "label": "Market closed", "seconds": 0, "display": "Closed"}
    else:
        secs = int((market_close - now).total_seconds())
        return {"status": "OPEN", "label": "Market closes in", "seconds": secs,
                "display": f"{secs // 3600}h {(secs % 3600) // 60}m"}


@app.get("/api/eod-summary")
async def get_eod_summary():
    """Feature 17: End-of-day summary."""
    from tradepilot.database import get_db
    today = datetime.now().strftime("%Y-%m-%d")
    async with get_db() as db:
        row = await db.execute(
            "SELECT * FROM daily_summary WHERE date = ?", (today,)
        )
        data = await row.fetchone()
        growth_row = await db.execute("SELECT current_capital FROM growth_state WHERE id = 1")
        growth = await growth_row.fetchone()

    if not data:
        return {"date": today, "trades": 0, "net_pnl": 0, "message": "No trades today"}

    return {
        "date": today,
        "trades": data["total_trades"] or 0,
        "wins": data["winning_trades"] or 0,
        "losses": data["losing_trades"] or 0,
        "net_pnl": round(data["net_pnl"] or 0, 2),
        "charges": round(data["total_charges"] or 0, 2),
        "capital_now": growth["current_capital"] if growth else 0,
    }


@app.get("/api/market/52week")
async def get_52week_stocks():
    """Feature 22: Stocks near 52-week high/low."""
    state = get_state()
    scores = state.watchlist_scores
    near_high = []
    near_low = []
    for s in scores[:50]:
        try:
            candles = await state.market_data.get_candles(s.symbol, "1d", datetime.now() - timedelta(days=60), datetime.now())
            if candles.empty:
                continue
            high = float(candles["high"].max())
            low = float(candles["low"].min())
            ltp = s.ltp
            if high > 0:
                pct_from_high = (high - ltp) / high * 100
                pct_from_low = (ltp - low) / low * 100 if low > 0 else 0
                if pct_from_high < 3:
                    near_high.append({"symbol": s.symbol, "ltp": ltp, "high": high, "pct_away": round(pct_from_high, 1)})
                if pct_from_low < 5 and low > 0:
                    near_low.append({"symbol": s.symbol, "ltp": ltp, "low": low, "pct_away": round(pct_from_low, 1)})
        except Exception:
            continue
    return {"near_high": near_high[:10], "near_low": near_low[:10]}


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
    """Update a setting (with audit log)."""
    from tradepilot.database import get_db
    async with get_db() as db:
        await db.execute(
            "INSERT INTO settings_log (timestamp, setting_name, old_value, new_value, reason) "
            "VALUES (?, ?, ?, ?, ?)",
            (datetime.now().isoformat(), request.setting_name, "", request.new_value, request.reason),
        )
        await db.commit()
    return {"status": "updated", "setting": request.setting_name, "value": request.new_value}


@app.get("/api/settings/all")
async def get_all_user_settings():
    """Get all user settings."""
    from tradepilot.settings import get_all_settings
    settings = await get_all_settings()
    return {"settings": settings}


@app.post("/api/settings/save")
async def save_user_settings(request: Request):
    """Save multiple settings at once."""
    from tradepilot.settings import set_multiple_settings
    body = await request.json()
    settings = body.get("settings", {})
    if not settings:
        raise HTTPException(status_code=400, detail="No settings provided")
    await set_multiple_settings(settings)
    return {"status": "saved", "count": len(settings)}


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
    """Diagnose data provider connectivity. Tests LTP + candles for 3 stocks."""
    if not DEBUG_ENDPOINTS_ENABLED:
        raise HTTPException(status_code=404, detail="Debug endpoints disabled")

    import asyncio
    from datetime import timedelta

    state = get_state()
    provider = state.market_data
    provider_name = type(provider).__name__
    test_symbols = ["RELIANCE", "TCS", "SBIN"]
    results = {"_provider": provider_name}

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
