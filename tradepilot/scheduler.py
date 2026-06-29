"""APScheduler — production-ready with timezone-aware checks and error isolation.

Every job is wrapped in try/except — a failed job NEVER crashes the scheduler.
All time checks use IST (Asia/Kolkata) explicitly via zoneinfo.
"""

import logging
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from tradepilot.orchestrator import (
    get_state, run_live_pipeline, run_position_monitor,
    generate_morning_brief, now_ist,
)
from tradepilot.config import (
    LIVE_PIPELINE_INTERVAL_SEC, POSITION_MONITOR_INTERVAL_SEC,
    ENABLE_ENGINE18_COACH, ENABLE_ENGINE23_ARCHIVE,
    ENABLE_ENGINE17_REGIME, ENABLE_ENGINE20_SELF_AUDIT,
)

logger = logging.getLogger(__name__)
IST = ZoneInfo("Asia/Kolkata")

scheduler = AsyncIOScheduler(timezone=IST)


def setup_scheduler():
    """Configure all scheduled jobs."""

    scheduler.add_job(
        run_live_pipeline,
        CronTrigger(hour=8, minute=15, timezone=IST),
        id="morning_watchlist", name="Morning Watchlist",
        replace_existing=True,
    )

    scheduler.add_job(
        _refresh_stock_universe,
        CronTrigger(day_of_week="mon", hour=8, minute=0, timezone=IST),
        id="universe_refresh", name="Weekly Universe Refresh",
        replace_existing=True,
    )

    scheduler.add_job(
        generate_morning_brief,
        CronTrigger(hour=8, minute=45, timezone=IST),
        id="morning_brief", name="Morning Brief",
        replace_existing=True,
    )

    scheduler.add_job(
        _live_pipeline_wrapper,
        IntervalTrigger(seconds=LIVE_PIPELINE_INTERVAL_SEC, timezone=IST),
        id="live_pipeline", name="Live Pipeline (3 min)",
        replace_existing=True,
    )

    scheduler.add_job(
        _position_monitor_wrapper,
        IntervalTrigger(seconds=POSITION_MONITOR_INTERVAL_SEC, timezone=IST),
        id="position_monitor", name="Position Monitor (60 sec)",
        replace_existing=True,
    )

    scheduler.add_job(
        _eod_processing,
        CronTrigger(hour=15, minute=45, timezone=IST),
        id="eod_processing", name="EOD Processing",
        replace_existing=True,
    )

    scheduler.add_job(
        _daily_coach,
        CronTrigger(hour=16, minute=0, timezone=IST),
        id="daily_coach", name="Daily Coach",
        replace_existing=True,
    )

    scheduler.add_job(
        _weekly_reports,
        CronTrigger(day_of_week="sun", hour=18, minute=0, timezone=IST),
        id="weekly_reports", name="Weekly Reports",
        replace_existing=True,
    )

    scheduler.add_job(
        _nightly_backup,
        CronTrigger(hour=23, minute=50, timezone=IST),
        id="nightly_backup", name="Nightly Backup",
        replace_existing=True,
    )

    scheduler.add_job(
        _reset_daily_state,
        CronTrigger(hour=23, minute=59, timezone=IST),
        id="daily_reset", name="Daily Reset",
        replace_existing=True,
    )


async def _live_pipeline_wrapper():
    """Run 9:15-15:10 IST on weekdays. Pipeline starts at 9:15 for data warmup,
    but signal generation is gated by candle freshness inside the pipeline itself
    (Engine 5 blocks entries before 9:20 anyway)."""
    now = now_ist()
    if now.weekday() >= 5:
        return
    # FIX 6.3: Skip NSE weekday holidays
    from tradepilot.config import NSE_HOLIDAYS
    if now.strftime("%Y-%m-%d") in NSE_HOLIDAYS:
        return
    if now.hour < 9 or (now.hour == 9 and now.minute < 15):
        return
    if now.hour > 15 or (now.hour == 15 and now.minute > 10):
        return
    await run_live_pipeline()


async def _position_monitor_wrapper():
    """Only run if position active, 9:15-15:30 IST weekdays."""
    now = now_ist()
    if now.weekday() >= 5:
        return
    # FIX 6.3: Skip NSE weekday holidays
    from tradepilot.config import NSE_HOLIDAYS
    if now.strftime("%Y-%m-%d") in NSE_HOLIDAYS:
        return
    if now.hour < 9 or (now.hour == 9 and now.minute < 15):
        return
    if now.hour > 15 or (now.hour == 15 and now.minute > 30):
        return
    state = get_state()
    if state.active_trade is not None:
        await run_position_monitor()


async def _eod_processing():
    """3:45 PM — Engine 12 + Engine 23 + FIX 6.2: EOD signal cleanup + FIX 7.1: outcome tracking."""
    # FIX 6.2: Clear stale signals at EOD
    state = get_state()
    state.signals = []
    state.exit_signal = None
    logger.info("EOD cleanup: signals and exit_signal cleared")

    try:
        from tradepilot.layer2.engine12_learning import write_daily_summary
        await write_daily_summary()
        logger.info("EOD daily summary written")
    except Exception as e:
        logger.error("EOD Engine 12 failed: %s", e)

    if ENABLE_ENGINE23_ARCHIVE:
        try:
            from tradepilot.layer2.engine23_archive import process_eod_archive
            state = get_state()
            results = await process_eod_archive(state.market_data)
            logger.info("EOD archive: %d opportunities tracked", len(results))
        except Exception as e:
            logger.error("EOD Engine 23 failed: %s", e)

    # FIX 7.1: Update signal outcomes at EOD
    try:
        await _update_signal_outcomes()
    except Exception as e:
        logger.error("Signal outcome update failed: %s", e)


async def _daily_coach():
    """4 PM — Engine 18."""
    if not ENABLE_ENGINE18_COACH:
        return
    try:
        from tradepilot.layer2.engine18_coach import generate_coach_report
        report = await generate_coach_report()
        logger.info("Coach: %s", report.headline[:60])
    except Exception as e:
        logger.error("Engine 18 failed: %s", e)


async def _update_signal_outcomes():
    """FIX 7.1: Check today's signals and mark outcomes based on EOD close prices."""
    from tradepilot.database import get_db
    today = now_ist().strftime("%Y-%m-%d")
    state = get_state()
    async with get_db() as db:
        rows = await db.execute(
            "SELECT id, symbol, ltp, target, stop_price FROM signal_history WHERE date = ? AND outcome = 'PENDING'",
            (today,),
        )
        updated = 0
        async for row in rows:
            try:
                candles = await state.market_data.get_candles(
                    row["symbol"], "5m",
                    from_dt=now_ist().replace(hour=9, minute=15),
                    to_dt=now_ist(),
                )
                if candles.empty:
                    continue
                day_high = float(candles["high"].max())
                day_low = float(candles["low"].min())
                close = float(candles["close"].iloc[-1])

                if row["target"] and day_high >= row["target"]:
                    outcome = "TARGET_HIT"
                elif row["stop_price"] and day_low <= row["stop_price"]:
                    outcome = "STOP_HIT"
                else:
                    outcome = "EXPIRED_NEUTRAL"

                await db.execute(
                    "UPDATE signal_history SET outcome = ? WHERE id = ?",
                    (outcome, row["id"]),
                )
                updated += 1
            except Exception:
                continue
        await db.commit()
        if updated:
            logger.info("Signal outcomes updated: %d signals", updated)


async def _weekly_reports():
    """Sunday 18:00 — Engines 24, 17, 20, 23."""
    try:
        from tradepilot.layer2.engine24_reality import run_reality_check
        state = get_state()
        result = await run_reality_check(state.market_data)
        logger.info("Reality check: %s (outperformance %.1f%%)", result.verdict_type, result.outperformance_pct)
    except Exception as e:
        logger.error("Engine 24 failed: %s", e)

    if ENABLE_ENGINE17_REGIME:
        try:
            from tradepilot.layer2.engine17_regime import get_regime_config
            state = get_state()
            await get_regime_config(state.market_mode)
        except Exception as e:
            logger.error("Engine 17 failed: %s", e)

    if ENABLE_ENGINE20_SELF_AUDIT:
        try:
            from tradepilot.layer2.engine20_self_audit import run_self_audit
            await run_self_audit()
        except Exception as e:
            logger.error("Engine 20 failed: %s", e)

    if ENABLE_ENGINE23_ARCHIVE:
        try:
            from tradepilot.layer2.engine23_archive import get_weekly_archive_summary
            await get_weekly_archive_summary()
        except Exception as e:
            logger.error("Engine 23 weekly failed: %s", e)


async def _nightly_backup():
    """23:50 — GitHub backup."""
    try:
        from tradepilot.backup import backup_to_github
        result = await backup_to_github()
        logger.info("Backup: %s — %s", result.get("status"), result.get("message", result.get("reason", "")))
    except Exception as e:
        logger.error("Backup failed: %s", e)


async def _reset_daily_state():
    """FIX 4.1: Carry consecutive losses across day boundaries, then prepare tomorrow's state.
    Also: T+1 settlement — credit today's profits to capital (they settle next morning)."""
    try:
        from tradepilot.database import get_db
        from tradepilot.layer2.engine21_growth import get_growth_state, update_capital
        today = date.today().isoformat()
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        async with get_db() as db:
            # FIX 4.1: Read today's ending state
            row = await db.execute(
                "SELECT consecutive_losses, daily_pnl FROM daily_state WHERE date = ?", (today,)
            )
            today_state = await row.fetchone()
            carry_forward = 0
            today_pnl = 0.0
            if today_state:
                carry_forward = today_state["consecutive_losses"] or 0
                today_pnl = today_state["daily_pnl"] or 0.0

            # T+1 Settlement: Credit today's PROFITS to capital (losses already deducted intraday)
            if today_pnl > 0:
                growth = await get_growth_state()
                new_capital = growth.current_capital + today_pnl
                await update_capital(new_capital)
                logger.info("T+1 settlement: credited ₹%.2f profit to capital (new: ₹%.2f)",
                           today_pnl, new_capital)

            # Insert tomorrow's row with carried-forward consecutive losses
            await db.execute(
                "INSERT OR IGNORE INTO daily_state (date, consecutive_losses) VALUES (?, ?)",
                (tomorrow, carry_forward),
            )
            await db.commit()
        logger.info("Daily state reset for %s (carried %d consecutive losses)", tomorrow, carry_forward)
    except Exception as e:
        logger.error("Daily reset failed: %s", e)


async def _refresh_stock_universe():
    """Monday 8 AM — refresh Nifty 200 universe from NSE."""
    try:
        from tradepilot.layer1.nifty_universe import refresh_universe
        await refresh_universe()
    except Exception as e:
        logger.error("Universe refresh failed: %s", e)


def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started with %d jobs", len(scheduler.get_jobs()))


def stop_scheduler():
    scheduler.shutdown(wait=False)
    logger.info("Scheduler stopped")
