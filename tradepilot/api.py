"""FastAPI application — production-ready with proper lifespan, validation, logging."""

import os
import time
import logging
from datetime import datetime, date, timedelta
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
    logger.info("TradePilot AI starting up...")
    await initialize()
    start_scheduler()
    logger.info("Startup complete — scheduler running")
    yield
    stop_scheduler()
    logger.info("Shutdown complete")


app = FastAPI(
    title="TradePilot AI",
    description="AI Trading Co-Pilot — Manual Execution, Zero Broker Integration",
    version="1.0.0",
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
        "version": "1.0.0",
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
        "ai_summary": brief.ai_summary,
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
            "ai_reasoning": state.reeval_result.ai_reasoning,
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
    """Market news feed — with time ago, source links, and AI analysis of impact."""
    news_state = await fetch_market_news()
    from tradepilot.layer2.engine_ai import analyze_with_gemini, analyze_with_groq
    from datetime import datetime as dt
    import email.utils

    items_with_time = []
    for item in news_state.items:
        # Parse published time to compute "hours ago"
        hours_ago = None
        if item.published:
            try:
                parsed_time = email.utils.parsedate_to_datetime(item.published)
                diff = datetime.now(parsed_time.tzinfo) - parsed_time
                hours_ago = round(diff.total_seconds() / 3600, 1)
            except Exception:
                pass

        items_with_time.append({
            "title": item.title,
            "summary": item.summary,
            "source": item.source,
            "sentiment": item.sentiment,
            "impact": item.impact,
            "hours_ago": hours_ago,
            "link": item.link,
            "published": item.published,
        })

    return {
        "mood": news_state.overall_mood,
        "mood_score": news_state.mood_score,
        "count": len(news_state.items),
        "last_fetched": news_state.last_fetched.isoformat() if news_state.last_fetched else None,
        "items": items_with_time,
    }


@app.get("/api/news/analyze")
async def analyze_news_impact():
    """AI analysis of today's news — how it affects the market."""
    from tradepilot.layer2.engine_ai import analyze_with_groq
    from tradepilot.layer2.engine27_news import _news_cache
    import aiohttp

    if not _news_cache or not _news_cache.items:
        return {"analysis": None, "error": "No news data available"}

    # Build news summary for AI
    headlines = "\n".join([f"- {item.title} ({item.sentiment})" for item in _news_cache.items[:10]])

    prompt = f"""You are an Indian stock market expert. Analyze these today's news headlines and tell me:
1. What is the overall market sentiment?
2. Which sectors will benefit from this news?
3. Which sectors might get hurt?
4. Any specific stocks mentioned that could move big?
5. Should a trader be aggressive or cautious today?

TODAY'S HEADLINES:
{headlines}

Respond in this JSON format:
{{
  "market_sentiment": "BULLISH" or "BEARISH" or "NEUTRAL",
  "summary": "2-3 sentences about overall market direction based on news",
  "sectors_positive": ["sector1", "sector2"],
  "sectors_negative": ["sector1", "sector2"],
  "stocks_to_watch": ["SYMBOL1", "SYMBOL2"],
  "trader_advice": "1-2 sentences - should I be aggressive or cautious and why"
}}"""

    # Use Groq for speed
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        return {"analysis": None, "error": "AI not configured"}

    try:
        url = "https://api.groq.com/openai/v1/chat/completions"
        payload = {
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.3, "max_tokens": 400,
        }
        headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    return {"analysis": None, "error": f"AI returned {resp.status}"}
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        # Parse JSON
        import json
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            analysis = json.loads(text[start:end])
            return {"analysis": analysis}
    except Exception as e:
        return {"analysis": None, "error": str(e)[:100]}

    return {"analysis": None}


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
    """100% AI-driven stock analysis. Feeds all data to AI, returns its verdict."""
    from tradepilot.layer2.engine4_discovery import (
        compute_rsi, compute_vwap, compute_macd, compute_ema, compute_atr
    )
    from tradepilot.layer2.engine_ai import dual_ai_analysis
    from tradepilot.layer2.engine21_growth import get_growth_state

    state = get_state()
    now = datetime.now()

    # Gather ALL data for AI to analyze
    candles_5m = await state.market_data.get_candles(symbol, "5m", now - timedelta(days=5), now)
    candles_1d = await state.market_data.get_candles(symbol, "1d", now - timedelta(days=30), now)

    if candles_5m.empty or len(candles_5m) < 10:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    ltp = float(candles_5m["close"].iloc[-1])
    closes = candles_5m["close"]
    highs = candles_5m["high"]
    lows = candles_5m["low"]
    volumes = candles_5m["volume"]

    # Compute all indicators — these are just DATA for AI to interpret
    rsi = compute_rsi(closes)
    vwap = compute_vwap(candles_5m)
    _, _, macd_hist = compute_macd(closes)
    ema9 = compute_ema(closes, 9)
    ema21 = compute_ema(closes, 21)
    daily_atr = compute_atr(candles_1d) if not candles_1d.empty and len(candles_1d) >= 5 else 0

    recent_vol = float(volumes.iloc[-5:].mean()) if len(volumes) >= 5 else 0
    avg_vol = float(volumes.iloc[-20:].mean()) if len(volumes) >= 20 else recent_vol
    volume_ratio = recent_vol / avg_vol if avg_vol > 0 else 1.0

    day_high = float(highs.iloc[-78:].max()) if len(highs) >= 78 else float(highs.max())
    day_low = float(lows.iloc[-78:].min()) if len(lows) >= 78 else float(lows.min())
    support = float(lows.iloc[-30:].min()) if len(lows) >= 30 else day_low
    resistance = float(highs.iloc[-30:].max()) if len(highs) >= 30 else day_high

    # 5-day price history for AI context
    price_history = ""
    if not candles_1d.empty:
        for _, row in candles_1d.tail(5).iterrows():
            price_history += f"  {str(row.get('timestamp', ''))[:10]}: O={row['open']:.1f} H={row['high']:.1f} L={row['low']:.1f} C={row['close']:.1f}\n"

    # Get sector
    from tradepilot.layer1.nifty_universe import get_sector_map
    sector = get_sector_map().get(symbol, "Unknown")

    # Get news context for this stock
    news_context = "Overall market mood: Neutral"
    brief_news_mood = "NEUTRAL"
    try:
        from tradepilot.layer2.engine27_news import _news_cache
        if _news_cache:
            brief_news_mood = _news_cache.overall_mood
            news_context = f"Overall market mood: {_news_cache.overall_mood}"
            if _news_cache.items:
                stock_news = [item for item in _news_cache.items if symbol.lower() in item.title.lower() or sector.lower() in item.title.lower()]
                if stock_news:
                    news_context += f"\nNews about {symbol}:\n"
                    for n in stock_news[:3]:
                        news_context += f"- {n.title} (Sentiment: {n.sentiment})\n"
                else:
                    news_context += "\nTop market headlines today:\n"
                    for n in _news_cache.items[:3]:
                        news_context += f"- {n.title} ({n.sentiment})\n"
    except Exception:
        pass

    # Build comprehensive data package for AI
    stock_data = {
        "ltp": round(ltp, 2),
        "day_high": round(day_high, 2),
        "day_low": round(day_low, 2),
        "rsi": round(rsi, 1),
        "ema9": round(ema9, 2),
        "ema21": round(ema21, 2),
        "macd": round(macd_hist, 4),
        "vwap": round(vwap, 2),
        "volume_ratio": round(volume_ratio, 2),
        "atr": round(daily_atr, 2),
        "support": round(support, 2),
        "resistance": round(resistance, 2),
        "price_history": price_history,
        "news_context": news_context,
    }

    # Let AI analyze everything
    ai_result = await dual_ai_analysis(symbol, stock_data)

    # Get capital info
    growth = await get_growth_state()
    capital = growth.current_capital
    leverage = 5.0

    # Use AI's entry/stop/target — not our calculations
    entry = ai_result.get("entry_price") or ltp
    stop = ai_result.get("stop_loss") or round(ltp - daily_atr * 0.3, 2)
    t1 = ai_result.get("target_1") or round(ltp + daily_atr * 0.5, 2)
    t2 = ai_result.get("target_2") or round(ltp + daily_atr * 0.8, 2)
    rr = ai_result.get("risk_reward") or 0

    # Position sizing from AI's levels
    risk_per_share = max(entry - stop, 0.5)
    max_qty = int((capital * leverage) // ltp)
    max_loss = capital * 0.02
    qty = min(max_qty, int(max_loss / risk_per_share) if risk_per_share > 0 else max_qty)

    # Charges
    from tradepilot.layer2.engine8_charges import calculate_angel_charges
    charges, breakdown = calculate_angel_charges(qty, entry, t1)
    net_profit = qty * (t1 - entry) - charges

    return {
        "symbol": symbol,
        "sector": sector,
        "ltp": ltp,
        "ai_analysis": {
            "verdict": ai_result["verdict"],
            "confidence": ai_result["confidence"],
            "action": ai_result.get("action", "WAIT"),
            "reasoning": ai_result.get("reasoning", []),
            "gemini_says": ai_result.get("gemini", {}).get("reasoning") if ai_result.get("gemini") else None,
            "groq_says": ai_result.get("groq", {}).get("reasoning") if ai_result.get("groq") else None,
        },
        "entry_price": entry,
        "stop_loss": stop,
        "targets": [
            {"level": 1, "price": t1, "label": "Target 1"},
            {"level": 2, "price": t2, "label": "Target 2"},
        ],
        "risk_reward": rr,
        "suggested_qty": qty,
        "capital_required": round(qty * entry / leverage, 2),
        "estimated_charges": round(charges, 2),
        "charges_breakdown": {
            "brokerage": breakdown.brokerage, "stt": breakdown.stt,
            "exchange_txn": breakdown.exchange_txn, "gst": breakdown.gst,
            "stamp_duty": breakdown.stamp_duty, "sebi": breakdown.sebi, "total": breakdown.total,
        },
        "net_profit_target1": round(net_profit, 2),
        "risk_per_share": round(risk_per_share, 2),
        "indicators": stock_data,
        "trend": "BULLISH" if ema9 > ema21 and macd_hist > 0 else "BEARISH" if ema9 < ema21 and macd_hist < 0 else "SIDEWAYS",
        "trend_description": ai_result.get("reasoning", [""])[0] if ai_result.get("reasoning") else "",
    }


# ═══════════════════════════════════════════════════════════════
# FEATURES 1-24: FULL TRADING TERMINAL ENDPOINTS
# ═══════════════════════════════════════════════════════════════


class PriceAlertRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=20)
    target_price: float = Field(..., gt=0)
    direction: str = Field(..., pattern="^(ABOVE|BELOW)$")


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
            "type": "pattern", "icon": "trophy",
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
            "type": "pattern", "icon": "clock",
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
            "type": "warning", "icon": "alert",
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
                    "type": "tip", "icon": "lightbulb",
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
            "type": "streak", "icon": streak_type and "flame" or "snowflake",
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


@app.get("/api/screener")
async def get_screener():
    """Screener — bullish/bearish stocks based on indicator alignment."""
    from tradepilot.layer2.engine4_discovery import compute_ema, compute_rsi, compute_macd, compute_vwap
    state = get_state()
    scores = state.watchlist_scores
    if not scores:
        return {"bullish": [], "bearish": [], "total_scanned": 0}

    bullish = []
    bearish = []

    for s in scores:
        try:
            # Use already-computed data from the scoring engine
            bull_points = 0
            bear_points = 0
            reasons = []

            # RSI
            if s.rsi > 50:
                bull_points += 1
            else:
                bear_points += 1

            # MACD
            if s.macd > 0:
                bull_points += 1
                reasons.append("MACD positive")
            else:
                bear_points += 1
                reasons.append("MACD negative")

            # Volume
            if s.volume_ratio > 1.2:
                bull_points += 1
                reasons.append(f"Vol {s.volume_ratio:.1f}x")
            elif s.volume_ratio < 0.8:
                bear_points += 1

            # Score-based (composite > 60 = momentum up)
            if s.composite > 62:
                bull_points += 1
                reasons.append(f"Score {s.composite:.0f}")
            elif s.composite < 55:
                bear_points += 1
                reasons.append(f"Score {s.composite:.0f}")

            # LTP vs VWAP
            if s.vwap > 0 and s.ltp > s.vwap:
                bull_points += 1
                reasons.append("Above VWAP")
            elif s.vwap > 0:
                bear_points += 1
                reasons.append("Below VWAP")

            # Determine strength
            strength = "STRONG" if bull_points >= 4 else "MEDIUM" if bull_points >= 3 else "MILD"

            stock_data = {
                "symbol": s.symbol, "sector": s.sector, "ltp": round(s.ltp, 2),
                "rsi": round(s.rsi, 1), "volume_ratio": round(s.volume_ratio, 1),
                "strength": strength,
                "ema_trend": "Bullish" if s.composite > 60 else "Bearish",
                "macd": "Positive" if s.macd > 0 else "Negative",
                "vwap": "Above" if s.vwap > 0 and s.ltp > s.vwap else "Below",
                "score": s.composite, "grade": s.grade.value,
                "reason": " + ".join(reasons[:4]) if reasons else "Mixed signals",
            }

            if bull_points >= 3:
                bullish.append(stock_data)
            elif bear_points >= 3:
                bearish.append(stock_data)

        except Exception:
            continue

    # Sort: strong first
    strength_order = {"STRONG": 0, "MEDIUM": 1, "MILD": 2}
    bullish.sort(key=lambda x: strength_order.get(x["strength"], 3))
    bearish.sort(key=lambda x: strength_order.get(x["strength"], 3))

    return {
        "bullish": bullish[:15],
        "bearish": bearish[:15],
        "total_scanned": len(scores),
        "last_scan": state.last_scan_time.isoformat() if state.last_scan_time else None,
    }


@app.get("/api/screener/timeframe")
async def get_screener_timeframe(tf: str = "1h"):
    """Timeframe-based screener + KST crossover signals."""
    from tradepilot.layer2.engine4_discovery import compute_ema, compute_rsi, compute_macd
    import pandas as pd
    state = get_state()
    scores = state.watchlist_scores
    if not scores:
        return {"bullish": [], "bearish": [], "kst_signals": [], "timeframe": tf, "total_scanned": 0}

    now = datetime.now()
    tf_map = {"5m": 5, "15m": 5, "1h": 15, "1d": 60, "1w": 90}
    days = tf_map.get(tf, 15)
    interval = tf if tf != "1w" else "1d"

    bullish = []
    bearish = []
    kst_signals = []

    for s in scores[:40]:
        try:
            candles = await state.market_data.get_candles(s.symbol, interval, now - timedelta(days=days), now)
            if candles.empty or len(candles) < 20:
                continue

            closes = candles["close"]
            ltp = float(closes.iloc[-1])
            prev = float(closes.iloc[-2]) if len(closes) >= 2 else ltp
            change_pct = ((ltp - prev) / prev * 100) if prev > 0 else 0
            if tf == "1w" and len(closes) >= 5:
                change_pct = ((ltp - float(closes.iloc[-5])) / float(closes.iloc[-5]) * 100)

            rsi = compute_rsi(closes)
            ema9 = compute_ema(closes, 9)
            ema21 = compute_ema(closes, 21)
            _, _, macd_hist = compute_macd(closes)

            bull = int(ema9 > ema21) + int(macd_hist > 0) + int(rsi > 50)
            bear = 3 - bull
            strength = "STRONG" if bull == 3 else "MEDIUM" if bull == 2 else "MILD"

            stock_data = {
                "symbol": s.symbol, "sector": s.sector, "ltp": round(ltp, 2),
                "change_pct": round(change_pct, 2), "rsi": round(rsi, 1),
                "ema_trend": "Bullish" if ema9 > ema21 else "Bearish",
                "macd": "Positive" if macd_hist > 0 else "Negative",
                "strength": strength, "grade": s.grade.value,
            }

            if bull >= 2:
                bullish.append(stock_data)
            else:
                bearish.append(stock_data)

            # KST crossover detection
            if len(closes) >= 30:
                kst, sig = _compute_kst_indicator(closes)
                if len(kst) >= 2:
                    if float(kst.iloc[-2]) <= float(sig.iloc[-2]) and float(kst.iloc[-1]) > float(sig.iloc[-1]):
                        kst_signals.append({**stock_data, "kst_direction": "BULLISH",
                            "kst_reason": f"KST crossed above signal — bullish momentum"})
                    elif float(kst.iloc[-2]) >= float(sig.iloc[-2]) and float(kst.iloc[-1]) < float(sig.iloc[-1]):
                        kst_signals.append({**stock_data, "kst_direction": "BEARISH",
                            "kst_reason": f"KST crossed below signal — bearish momentum"})

        except Exception:
            continue

    bullish.sort(key=lambda x: x["change_pct"], reverse=True)
    bearish.sort(key=lambda x: x["change_pct"])

    return {
        "bullish": bullish[:15], "bearish": bearish[:15],
        "kst_signals": kst_signals[:10], "timeframe": tf,
        "total_scanned": len(scores),
        "last_scan": state.last_scan_time.isoformat() if state.last_scan_time else None,
    }


def _compute_kst_indicator(closes):
    """KST (Know Sure Thing) + signal line."""
    import pandas as pd
    c = pd.Series(closes.values)
    kst = pd.Series(0.0, index=c.index)
    for roc_p, sma_p, w in zip([10, 15, 20, 30], [10, 10, 10, 15], [1, 2, 3, 4]):
        if len(c) <= roc_p:
            continue
        roc = ((c - c.shift(roc_p)) / c.shift(roc_p)) * 100
        kst = kst + (roc.rolling(window=min(sma_p, len(c) - roc_p)).mean().fillna(0) * w)
    return kst, kst.rolling(window=9).mean()
def _compute_kst(closes) -> tuple:
    """Compute KST (Know Sure Thing) indicator and its signal line.
    
    KST = weighted sum of 4 rate-of-change values smoothed by SMA.
    Signal = 9-period SMA of KST.
    """
    import pandas as pd
    closes = pd.Series(closes.values) if hasattr(closes, 'values') else pd.Series(closes)

    # ROC periods and SMA smoothing periods
    roc_periods = [10, 15, 20, 30]
    sma_periods = [10, 10, 10, 15]
    weights = [1, 2, 3, 4]

    kst = pd.Series(0.0, index=closes.index)
    for roc_p, sma_p, w in zip(roc_periods, sma_periods, weights):
        if len(closes) <= roc_p:
            continue
        roc = ((closes - closes.shift(roc_p)) / closes.shift(roc_p)) * 100
        smoothed = roc.rolling(window=min(sma_p, len(closes) - roc_p)).mean()
        kst = kst + (smoothed * w)

    signal = kst.rolling(window=9).mean()
    return kst, signal


def _build_signal_reason(hourly: str, daily: str, weekly: str, strength: str) -> str:
    """Build plain English reason for the signal."""
    direction = "Bullish" if hourly == "BULLISH" else "Bearish"

    if strength == "STRONG":
        return f"{direction} crossover on hourly. Daily and weekly both confirm — all timeframes aligned."
    elif strength == "MEDIUM":
        agreeing = "Daily" if (daily == hourly) else "Weekly"
        return f"{direction} crossover on hourly. {agreeing} trend agrees — moderate confidence."
    else:
        return f"{direction} crossover on hourly, but daily and weekly disagree — proceed with caution."


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
    capital: float = Field(..., ge=1000, le=10000000)


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
    """DEV ONLY. Rate-limited. Respects Engine 11 gate."""
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
    """DEV ONLY. Rate-limited."""
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


@app.get("/api/debug/gemini-test")
async def debug_gemini_test():
    """Test AI APIs directly — shows exact error if it fails."""
    import aiohttp

    results = {}

    # Test OpenRouter
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    if openrouter_key:
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            payload = {
                "model": "google/gemma-4-26b-a4b-it:free",
                "messages": [{"role": "user", "content": "Say hello in JSON: {\"message\": \"hello\"}"}],
                "temperature": 0.1, "max_tokens": 50,
            }
            headers = {"Authorization": f"Bearer {openrouter_key}", "Content-Type": "application/json",
                       "HTTP-Referer": "https://tradepilot.app", "X-Title": "TradePilot AI"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                    status = resp.status
                    body = await resp.text()
                    if status == 200:
                        import json
                        data = json.loads(body)
                        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        results["openrouter"] = {"status": "success", "model": "gemma-4-26b", "response": text[:200]}
                    else:
                        results["openrouter"] = {"status": "error", "http_status": status, "body": body[:300]}
        except Exception as e:
            results["openrouter"] = {"status": "error", "reason": str(e)[:200]}
    else:
        results["openrouter"] = {"status": "not_configured", "fix": "Set OPENROUTER_API_KEY env var"}

    # Test Gemini (removed — using OpenRouter instead)
    results["gemini"] = {"status": "removed", "note": "Replaced by OpenRouter"}

    # Test Groq
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key:
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            payload = {"model": "llama-3.3-70b-versatile",
                       "messages": [{"role": "user", "content": "Say hello in JSON: {\"message\": \"hello\"}"}],
                       "temperature": 0.1, "max_tokens": 50}
            headers = {"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                    status = resp.status
                    body = await resp.text()
                    if status == 200:
                        import json
                        data = json.loads(body)
                        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                        results["groq"] = {"status": "success", "model": "llama-3.3-70b", "response": text[:200]}
                    else:
                        results["groq"] = {"status": "error", "http_status": status, "body": body[:300]}
        except Exception as e:
            results["groq"] = {"status": "error", "reason": str(e)[:200]}
    else:
        results["groq"] = {"status": "not_configured", "fix": "Set GROQ_API_KEY env var"}

    # Summary
    working = [k for k, v in results.items() if v.get("status") == "success"]
    return {"working_apis": working, "total_working": len(working), "details": results}
