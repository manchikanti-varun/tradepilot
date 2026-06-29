"""Orchestrator — production-ready pipeline coordinator.

Hardened:
- Top-level try/except on every pipeline run (never crashes the scheduler)
- Per-stock error isolation (one stock failure doesn't kill the scan)
- Timezone-aware datetime (Asia/Kolkata) for all market-hour checks
- Structured logging throughout
- Proper DB context manager usage
"""

import asyncio
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional
from dataclasses import dataclass, field
from zoneinfo import ZoneInfo

from tradepilot.config import (
    CapitalTier, Grade, MarketMode, RiskGate, TradePhase,
    LIVE_PIPELINE_INTERVAL_SEC, POSITION_MONITOR_INTERVAL_SEC,
    TIER_CONFIGS, MIN_COMPOSITE_FOR_ENTRY,
    ENABLE_ENGINE13_EVENTS, ENABLE_ENGINE14_OPPORTUNITY_COST,
    ENABLE_ENGINE2_FII_DII, ENABLE_ENGINE3_BREADTH,
    ENABLE_ENGINE18_COACH, ENABLE_ENGINE23_ARCHIVE,
)
from tradepilot.layer1.base import MarketDataProvider
from tradepilot.layer1.yahoo_provider import YahooFinanceProvider
from tradepilot.layer2.engine4_discovery import (
    build_watchlist, scan_and_score, StockScore, compute_atr,
    compute_rsi, compute_vwap, compute_macd, compute_ema,
    TOP_SECTORS, AVOID_SECTORS,
)
from tradepilot.layer2.engine5_entry import check_entry_conditions, EntryCheckResult
from tradepilot.layer2.engine6_allocation import compute_allocation, AllocationResult
from tradepilot.layer2.engine7_simulator import simulate_trade, SimulationResult
from tradepilot.layer2.engine8_charges import calculate_angel_charges
from tradepilot.layer2.engine10_exit import evaluate_exit, ExitSignal
from tradepilot.layer2.engine11_risk import evaluate_risk, RiskState, record_trade_result
from tradepilot.layer2.engine13_events import evaluate_event_risk, EventRisk
from tradepilot.layer2.engine16_reeval import re_evaluate_position, ReEvalResult
from tradepilot.layer2.engine21_growth import get_growth_state, update_capital, GrowthState, lookup_tier
from tradepilot.layer2.engine22_rejections import log_rejection, get_daily_rejection_summary
from tradepilot.layer2.engine24_reality import run_reality_check, check_mvp_exit_criteria
from tradepilot.layer2.engine25_intake import parse_trade_input, ParsedIntake
from tradepilot.layer2.engine26_brief import build_morning_brief, MorningBrief
from tradepilot.layer3.tracker import TradeTracker, Trade, DuplicatePositionError
from tradepilot.database import init_db, get_db

logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")


def now_ist() -> datetime:
    """Get current time in IST — used for all market-hour checks."""
    return datetime.now(IST)


def _create_provider() -> MarketDataProvider:
    """Create the best available market data provider.
    
    Uses Hybrid (yfinance bulk + Angel One real-time) if Angel One credentials
    are available (from user DB or env vars), otherwise falls back to Yahoo Finance only.
    """
    from tradepilot.layer1.angel_provider import _get_credentials
    creds = _get_credentials()
    if all(creds.values()):
        from tradepilot.layer1.hybrid_provider import HybridProvider
        logger.info("Using Hybrid provider: yfinance (200 stocks) + Angel One (real-time)")
        return HybridProvider()
    else:
        logger.info("Angel One credentials not found — using Yahoo Finance only")
        return YahooFinanceProvider()


@dataclass
class SignalCard:
    symbol: str
    sector: str
    grade: str
    composite: float
    ltp: float
    qty: int
    stop_price: float
    target: float
    net_after_charges: float
    breakeven_pct: float
    risk_reward: float
    allocation: AllocationResult
    simulation: SimulationResult
    entry_check: EntryCheckResult
    message: str
    priority: int
    generated_at: datetime = field(default_factory=datetime.now)
    # FIX 1.3: Track when the price was fetched for staleness detection
    price_timestamp: datetime = field(default_factory=datetime.now)

    @property
    def price_age_sec(self) -> int:
        """Seconds since the LTP was fetched."""
        return int((datetime.now() - self.price_timestamp).total_seconds())


@dataclass
class SystemState:
    market_data: MarketDataProvider = field(default_factory=lambda: _create_provider())
    tracker: TradeTracker = field(default_factory=TradeTracker)
    growth_state: Optional[GrowthState] = None
    risk_state: Optional[RiskState] = None
    event_risk: Optional[EventRisk] = None
    watchlist_scores: list[StockScore] = field(default_factory=list)
    signals: list[SignalCard] = field(default_factory=list)
    active_trade: Optional[Trade] = None
    exit_signal: Optional[ExitSignal] = None
    reeval_result: Optional[ReEvalResult] = None
    morning_brief: Optional[MorningBrief] = None
    market_mode: MarketMode = MarketMode.NORMAL
    last_scan_time: Optional[datetime] = None
    is_running: bool = False
    last_error: Optional[str] = None
    # FIX 1.2: Dead-feed detection counter
    consecutive_data_failures: int = 0
    MAX_DATA_FAILURES: int = 3


_state: Optional[SystemState] = None


def get_state() -> SystemState:
    global _state
    if _state is None:
        _state = SystemState()
    return _state


async def initialize():
    """Initialize database and load state."""
    await init_db()
    state = get_state()

    # Load stock universe (from DB or NSE)
    try:
        from tradepilot.layer1.nifty_universe import get_universe_async
        universe = await get_universe_async()
        logger.info("Stock universe loaded: %d stocks", len(universe))
    except Exception as e:
        logger.warning("Universe load failed (using fallback): %s", e)

    state.growth_state = await get_growth_state()
    state.active_trade = await state.tracker.get_active_trade()
    logger.info(
        "Initialized — capital=%.2f tier=%s active_trade=%s",
        state.growth_state.current_capital,
        state.growth_state.current_tier.value,
        state.active_trade.ticker if state.active_trade else "none",
    )


async def run_live_pipeline():
    """3-min live scoring pipeline. Never raises — logs errors and continues."""
    state = get_state()
    state.is_running = True
    try:
        await _run_live_pipeline_inner()
        state.last_error = None
    except Exception as e:
        state.last_error = str(e)[:200]
        logger.exception("Live pipeline failed: %s", state.last_error)
    finally:
        state.is_running = False
        state.last_scan_time = now_ist()


async def _run_live_pipeline_inner():
    """Inner pipeline logic — allowed to raise."""
    state = get_state()

    # Engine 21: Growth state
    state.growth_state = await get_growth_state()
    growth = state.growth_state
    tier = growth.current_tier
    capital = growth.current_capital

    # Engine 27: Fetch news (caches for 10 min, non-blocking)
    try:
        from tradepilot.layer2.engine27_news import fetch_market_news
        await fetch_market_news()
    except Exception as e:
        logger.warning("Engine 27 news fetch failed: %s", e)

    # Engine 13: Event risk
    if ENABLE_ENGINE13_EVENTS:
        state.event_risk = evaluate_event_risk()
    else:
        state.event_risk = EventRisk(
            level="NONE", events_today=[], size_multiplier=1.0,
            grade_floor="B", exit_by_hour=0, is_expiry_day=False, stop_widen_pct=0,
        )

    # Engine 1: Market data
    # FIX 1.2: Dead-feed detection — halt signals after 3 consecutive failures
    try:
        vix = await state.market_data.get_vix()
        state.consecutive_data_failures = 0  # Reset on success
    except Exception:
        state.consecutive_data_failures += 1
        if state.consecutive_data_failures >= state.MAX_DATA_FAILURES:
            logger.error("DEAD FEED: %d consecutive data failures — halting signals",
                         state.consecutive_data_failures)
            state.signals = []
            return
        vix = 14.0

    # Engine 11: Risk evaluation
    nifty_change = 0.0
    try:
        # Compute real Nifty change from today's open
        try:
            nifty_current = await state.market_data.get_nifty_value()
            if nifty_current > 0:
                async with get_db() as db:
                    row = await db.execute(
                        "SELECT open_value FROM nifty_daily WHERE date = ?",
                        (now_ist().strftime("%Y-%m-%d"),),
                    )
                    data = await row.fetchone()
                    if data and data["open_value"] and data["open_value"] > 0:
                        nifty_change = (nifty_current - data["open_value"]) / data["open_value"] * 100
                    else:
                        # Store today's open if not yet stored
                        await db.execute(
                            "INSERT OR IGNORE INTO nifty_daily (date, open_value) VALUES (?, ?)",
                            (now_ist().strftime("%Y-%m-%d"), nifty_current),
                        )
                        await db.commit()
        except Exception as e:
            logger.warning("Nifty change calc failed: %s", e)

        state.risk_state = await evaluate_risk(
            current_capital=capital, tier=tier, is_proven=growth.is_proven,
            progress_pct_to_next_tier=growth.progress_pct_to_next_tier,
            vix=vix, nifty_change_pct=nifty_change,
        )
    except Exception as e:
        logger.error("Engine 11 failed: %s", e)
        state.risk_state = RiskState(
            gate=RiskGate.CAUTION, reason="Risk evaluation error",
            trades_remaining=0, daily_pnl=0, consecutive_losses=0,
            size_multiplier=0.5, caution_notes=["Engine 11 error — conservative mode"],
        )

    if state.risk_state.gate == RiskGate.HARD_STOP:
        state.signals = []
        logger.info("Hard stop active: %s", state.risk_state.reason)
        return

    # FIX 3.2: Market mode from VIX + Nifty trend (moved after nifty_change computation)
    if vix > 22:
        state.market_mode = MarketMode.HIGH_VOL
    elif nifty_change > 0.8:
        state.market_mode = MarketMode.TRENDING
    else:
        state.market_mode = MarketMode.NORMAL

    # Engine 3: Breadth
    top_sectors = list(TOP_SECTORS)
    avoid_sectors = list(AVOID_SECTORS)
    if ENABLE_ENGINE3_BREADTH:
        try:
            from tradepilot.layer2.engine3_breadth import get_market_breadth
            breadth = await get_market_breadth()
            if breadth.top_sectors:
                top_sectors = breadth.top_sectors
            if breadth.avoid_sectors:
                avoid_sectors = breadth.avoid_sectors
        except Exception as e:
            logger.warning("Engine 3 failed: %s", e)

    # Engine 4: Score watchlist
    watchlist_instruments = await build_watchlist(state.market_data, capital, tier)
    scores = await scan_and_score(state.market_data, watchlist_instruments, top_sectors, avoid_sectors)

    # Engine 2: FII/DII modifier
    if ENABLE_ENGINE2_FII_DII:
        try:
            from tradepilot.layer2.engine2_fii_dii import get_fii_dii_flow
            flow = await get_fii_dii_flow()
            if flow.score_modifier != 0:
                from tradepilot.layer2.engine4_discovery import compute_grade
                for s in scores:
                    s.composite = min(100, max(0, s.composite + flow.score_modifier))
                    s.grade = compute_grade(s.composite)
        except Exception as e:
            logger.warning("Engine 2 failed: %s", e)

    state.watchlist_scores = scores
    logger.info("Scored %d stocks, %d A+/A", len(scores), sum(1 for s in scores if s.grade in (Grade.A_PLUS, Grade.A)))

    # If active trade, skip signal generation
    state.active_trade = await state.tracker.get_active_trade()
    if state.active_trade is not None:
        return

    # FIX 3.3: Check Angel One for external positions not tracked by TradePilot
    try:
        if hasattr(state.market_data, '_angel') and state.market_data._angel is not None:
            from tradepilot.layer1.angel_provider import _session
            if _session.is_logged_in and _session.smart_api:
                loop = asyncio.get_event_loop()
                positions = await loop.run_in_executor(
                    None, _session.smart_api.position
                )
                if positions and positions.get("data"):
                    open_positions = [p for p in positions["data"] if float(p.get("netqty", 0)) != 0]
                    if open_positions:
                        logger.warning("External Angel One positions detected (%d) — skipping signal generation",
                                       len(open_positions))
                        state.signals = []
                        return
    except Exception as e:
        logger.debug("Angel One position check unavailable: %s", str(e)[:60])

    # Filter to allowed grades — full capital on best picks only
    min_grade_set = {Grade.A_PLUS, Grade.A, Grade.B}
    if state.event_risk.grade_floor == "A+":
        min_grade_set = {Grade.A_PLUS}
    elif state.event_risk.grade_floor == "A":
        min_grade_set = {Grade.A_PLUS, Grade.A}
    top_scores = [s for s in scores if s.grade in min_grade_set]

    # Engine 22: Log rejections
    for s in scores:
        if s.grade not in min_grade_set:
            await log_rejection(s.symbol, "GRADE_TOO_LOW", s.composite, s.ltp)
        elif s.volume_score < 50:
            await log_rejection(s.symbol, "VOLUME_WEAK", s.composite, s.ltp)

    # Generate signals for top picks
    signals: list[SignalCard] = []
    for i, score in enumerate(top_scores[:5]):
        try:
            signal = await _build_signal_card(score, i + 1, state, growth)
            if signal:
                signals.append(signal)
        except Exception as e:
            logger.warning("Signal generation failed for %s: %s", score.symbol, e)
            continue

    state.signals = signals
    if signals:
        logger.info("Priority #1: %s (net ₹%.2f)", signals[0].symbol, signals[0].net_after_charges)
        # Log signal to history
        try:
            async with get_db() as db:
                for sig in signals[:3]:  # Log top 3
                    await db.execute(
                        """INSERT INTO signal_history
                        (date, timestamp, symbol, sector, grade, composite, ltp, qty, stop_price, target, net_after_charges, risk_reward)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (now_ist().strftime("%Y-%m-%d"), now_ist().isoformat(),
                         sig.symbol, sig.sector, sig.grade, sig.composite,
                         sig.ltp, sig.qty, sig.stop_price, sig.target,
                         sig.net_after_charges, sig.risk_reward),
                    )
                await db.commit()
        except Exception as e:
            logger.warning("Failed to log signal history: %s", e)


async def _build_signal_card(score: StockScore, priority: int, state: SystemState, growth: GrowthState) -> Optional[SignalCard]:
    """Build a single signal card. Returns None if any gate fails."""
    # Engine 5
    entry_result = await check_entry_conditions(
        score=score, market_data=state.market_data,
        has_active_position=False, risk_gate=state.risk_state.gate,
        event_risk=state.event_risk.level,
    )
    if not entry_result.passed:
        await log_rejection(score.symbol, f"ENGINE5: {entry_result.reason}", score.composite, score.ltp)
        return None

    # ATR — use daily candles for proper intraday targets
    candles = await state.market_data.get_candles(
        score.symbol, "5m", from_dt=now_ist() - timedelta(days=5), to_dt=now_ist(),
    )
    atr_5m = compute_atr(candles)

    # Get daily ATR for realistic target/stop
    daily_candles = await state.market_data.get_candles(
        score.symbol, "1d", from_dt=now_ist() - timedelta(days=30), to_dt=now_ist(),
    )
    daily_atr = compute_atr(daily_candles) if not daily_candles.empty and len(daily_candles) >= 5 else 0

    # Use daily ATR if available, otherwise estimate from 5m
    # 5m ATR to daily ATR: multiply by ~6 (empirical scaling for Indian markets)
    atr = daily_atr if daily_atr > 0 else (atr_5m * 6 if atr_5m > 0 else 0)
    if atr <= 0:
        await log_rejection(score.symbol, "ATR_ZERO", score.composite, score.ltp)
        return None

    # Engine 6
    allocation = compute_allocation(
        current_capital=growth.current_capital, tier=growth.current_tier,
        grade=score.grade, ltp=score.ltp, atr=atr,
        market_mode=state.market_mode, is_proven=growth.is_proven,
        progress_pct_to_next_tier=growth.progress_pct_to_next_tier,
    )
    if not allocation.viable:
        await log_rejection(score.symbol, f"ENGINE6: {allocation.message}", score.composite, score.ltp)
        return None

    # Size multipliers
    adjusted_qty = max(1, int(allocation.qty * state.risk_state.size_multiplier * state.event_risk.size_multiplier))
    if adjusted_qty == 0:
        return None

    # Engine 7
    sim = simulate_trade(ltp=score.ltp, qty=adjusted_qty, atr=atr,
                         capital_to_use=allocation.capital_to_use, stop_price=allocation.stop_price)
    if not sim.passed:
        await log_rejection(score.symbol, f"ENGINE7: {sim.block_reason} (RR={sim.risk_reward}, qty={adjusted_qty}, atr={atr:.2f})", score.composite, score.ltp)
        return None

    target = score.ltp + atr * 0.6
    return SignalCard(
        symbol=score.symbol, sector=score.sector, grade=score.grade.value,
        composite=score.composite, ltp=score.ltp, qty=adjusted_qty,
        stop_price=allocation.stop_price, target=round(target, 2),
        net_after_charges=sim.avg.net_pnl, breakeven_pct=sim.min_profitable_move_pct,
        risk_reward=sim.risk_reward, allocation=allocation,
        simulation=sim, entry_check=entry_result,
        message=f"BUY {score.symbol} qty={adjusted_qty} @ ~₹{score.ltp:.2f}",
        priority=priority,
    )


async def run_position_monitor():
    """60-sec position monitor. Never raises."""
    state = get_state()
    try:
        await _run_position_monitor_inner()
    except Exception as e:
        logger.exception("Position monitor failed: %s", str(e)[:100])


async def _run_position_monitor_inner():
    state = get_state()
    trade = await state.tracker.get_active_trade()
    if trade is None:
        state.active_trade = None
        state.exit_signal = None
        state.reeval_result = None
        return

    state.active_trade = trade
    current_ltp = await state.market_data.get_ltp(trade.ticker)
    if current_ltp == 0:
        return

    await state.tracker.update_trade(trade.id, current_ltp)

    candles = await state.market_data.get_candles(
        trade.ticker, "5m", from_dt=now_ist() - timedelta(days=2), to_dt=now_ist(),
    )
    if candles.empty:
        return

    closes = candles["close"]
    rsi = compute_rsi(closes)
    vwap = compute_vwap(candles)
    _, _, macd_hist = compute_macd(closes)
    ema9 = compute_ema(closes, 9)
    volumes = candles["volume"]
    recent_vol = float(volumes.iloc[-5:].mean()) if len(volumes) >= 5 else 0
    avg_vol = float(volumes.iloc[-20:].mean()) if len(volumes) >= 20 else recent_vol
    volume_ratio = recent_vol / avg_vol if avg_vol > 0 else 1.0

    peak = max(trade.peak_price or trade.entry_price, current_ltp)
    atr = trade.atr_at_entry or compute_atr(candles)
    stop = trade.stop_price or (trade.entry_price - atr * 0.4)
    trail = trade.trail_stop or stop

    # Engine 10
    exit_signal = evaluate_exit(
        entry_price=trade.entry_price, current_ltp=current_ltp,
        peak_price=peak, stop_price=stop, trail_stop=trail,
        atr=atr, phase=trade.phase, rsi=rsi,
        volume_ratio=volume_ratio, macd_hist=macd_hist,
        vwap=vwap, ema9=ema9, entry_time=trade.entry_time,
        market_mode=state.market_mode,
    )
    state.exit_signal = exit_signal

    # Engine 16
    reeval = await re_evaluate_position(
        ticker=trade.ticker, sector=trade.sector or "",
        market_data=state.market_data, news_sentiment_at_entry=55.0,
        sector_was_top_at_entry=trade.sector_was_top_at_entry,
        avoid_sectors=AVOID_SECTORS,
        # AI context
        entry_price=trade.entry_price,
        current_ltp=current_ltp,
        pnl=current_ltp - trade.entry_price,
        hold_min=(now_ist() - trade.entry_time).total_seconds() / 60 if trade.entry_time else 0,
        stop_price=stop,
        peak_price=peak,
        rsi=rsi,
        macd=macd_hist,
        volume_ratio=volume_ratio,
        above_vwap=current_ltp > vwap,
        ema_bullish=ema9 > compute_ema(closes, 21),
        market_mode=state.market_mode.value,
    )
    state.reeval_result = reeval

    if reeval.override_exit and not exit_signal.should_exit:
        state.exit_signal = ExitSignal(
            should_exit=True, exit_type="HARD", reason=reeval.reason,
            urgency="EXIT_NOW", suggested_exit_price=current_ltp,
            phase=trade.phase, trail_stop=trail, new_stop=stop,
        )
        logger.warning("Engine 16 EXIT override: %s", reeval.reason)

    if exit_signal.should_exit:
        logger.info("EXIT signal for %s: %s (%s)", trade.ticker, exit_signal.reason, exit_signal.urgency)


async def process_intake(text: str) -> dict:
    """Process trade intake (Engine 25). Validates and logs."""
    if not text or len(text) > 500:
        return {"status": "error", "message": "Input must be 1-500 characters."}

    state = get_state()
    parsed = parse_trade_input(text)

    # Log to intake_log
    try:
        async with get_db() as db:
            await db.execute(
                """INSERT INTO intake_log (timestamp, raw_input, parsed_intent, parsed_ticker,
                    parsed_price, parsed_qty, confidence, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (now_ist().isoformat(), text, parsed.intent, parsed.ticker,
                 parsed.price, parsed.qty, parsed.confidence, "pending"),
            )
            await db.commit()
    except Exception as e:
        logger.error("Failed to log intake: %s", e)

    if parsed.ambiguous_fields:
        return {
            "status": "clarification_needed",
            "parsed": _intake_to_dict(parsed),
            "message": parsed.clarification_needed,
        }

    active = await state.tracker.get_active_trade()

    if parsed.intent == "BUY":
        if active is not None:
            return {
                "status": "rejected",
                "parsed": _intake_to_dict(parsed),
                "message": f"You already have an open {active.ticker} position — did you mean to report an exit?",
            }
        return {"status": "confirm_entry", "parsed": _intake_to_dict(parsed), "message": parsed.echo_message}

    elif parsed.intent == "SELL":
        if active is None:
            return {"status": "rejected", "parsed": _intake_to_dict(parsed),
                    "message": "No active position to close. Did you mean to report a BUY?"}
        if active.ticker != parsed.ticker:
            return {"status": "rejected", "parsed": _intake_to_dict(parsed),
                    "message": f"Active position is {active.ticker}, but you said {parsed.ticker}."}
        return {"status": "confirm_exit", "parsed": _intake_to_dict(parsed), "message": parsed.echo_message}

    return {"status": "clarification_needed", "parsed": _intake_to_dict(parsed),
            "message": "Was this a BUY (entry) or SELL (exit)?"}


async def confirm_intake(parsed_data: dict) -> dict:
    """Confirm and commit. Validates inputs before committing."""
    state = get_state()
    intent = parsed_data.get("intent")
    ticker = parsed_data.get("ticker")
    price = parsed_data.get("price")
    qty = parsed_data.get("qty")

    # Input validation
    if not ticker or not price or not qty:
        return {"status": "error", "message": "Missing required fields."}
    if price <= 0 or price > 50000:
        return {"status": "error", "message": f"Price ₹{price} is out of valid range (0-50000)."}
    if qty <= 0 or qty > 500:
        return {"status": "error", "message": f"Qty {qty} is out of valid range (1-500)."}

    now = now_ist()

    if intent == "BUY":
        growth = await get_growth_state()
        tier_config = TIER_CONFIGS[growth.current_tier]
        leverage = tier_config.leverage
        capital_used = qty * price / leverage

        try:
            trade = await state.tracker.start_trade(
                ticker=ticker, entry_price=price, qty=qty,
                entry_time=now, capital_used=capital_used,
                capital_tier=growth.current_tier.value, leverage=leverage,
            )
        except DuplicatePositionError as e:
            return {"status": "rejected", "message": str(e)}

        state.active_trade = trade

        # Store Nifty value for Engine 24
        try:
            nifty_val = await state.market_data.get_nifty_value()
            if nifty_val > 0:
                async with get_db() as db:
                    await db.execute(
                        "INSERT OR REPLACE INTO nifty_daily (date, open_value) VALUES (?, ?)",
                        (now.strftime("%Y-%m-%d"), nifty_val),
                    )
                    await db.commit()
        except Exception:
            pass

        return {"status": "trade_opened", "trade_id": trade.id,
                "message": f"Position opened: {ticker} qty {qty} @ ₹{price:.2f}. Monitoring started."}

    elif intent == "SELL":
        active = await state.tracker.get_active_trade()
        if active is None:
            return {"status": "error", "message": "No active position to close."}

        trade = await state.tracker.close_trade(
            trade_id=active.id, exit_price=price, exit_time=now, exit_reason="manual_exit",
        )

        # Update capital
        growth = await get_growth_state()
        new_capital = growth.current_capital + (trade.pnl.net_pnl if trade.pnl else 0)
        await update_capital(new_capital)

        # Update risk state
        if trade.pnl:
            await record_trade_result(trade.pnl.net_pnl)

        # Store Nifty close for Engine 24
        try:
            nifty_val = await state.market_data.get_nifty_value()
            if nifty_val > 0:
                async with get_db() as db:
                    await db.execute(
                        "UPDATE nifty_daily SET close_value = ? WHERE date = ?",
                        (nifty_val, now.strftime("%Y-%m-%d")),
                    )
                    await db.commit()
        except Exception:
            pass

        state.active_trade = None
        state.exit_signal = None
        pnl = trade.pnl

        return {
            "status": "trade_closed", "trade_id": trade.id,
            "pnl": {
                "gross": pnl.gross_pnl, "charges": pnl.total_charges,
                "net": pnl.net_pnl, "net_pct": pnl.net_pnl_pct,
                "charge_drag": pnl.charge_pct_of_gross,
            } if pnl else None,
            "message": (
                f"Position closed: {ticker} @ ₹{price:.2f}. "
                f"Net P&L: ₹{pnl.net_pnl:.2f} ({pnl.net_pnl_pct:.1f}%) | "
                f"Charges: ₹{pnl.total_charges:.2f} ({pnl.charge_pct_of_gross:.0f}% of gross)"
                if pnl else f"Position closed: {ticker} @ ₹{price:.2f}"
            ),
        }

    return {"status": "error", "message": "Unknown intent."}


async def generate_morning_brief() -> MorningBrief:
    """Generate Engine 26 morning brief. Never raises."""
    state = get_state()
    try:
        return await _generate_morning_brief_inner()
    except Exception as e:
        logger.exception("Morning brief generation failed: %s", e)
        # Return minimal brief
        growth = state.growth_state or await get_growth_state()
        return build_morning_brief(
            growth_state=growth, watchlist_scores=[],
            risk_gate=RiskGate.GO, risk_reason=None, trades_remaining=4,
        )


async def _generate_morning_brief_inner() -> MorningBrief:
    state = get_state()
    growth = await get_growth_state()
    state.growth_state = growth

    watchlist = await build_watchlist(state.market_data, growth.current_capital, growth.current_tier)
    scores = await scan_and_score(state.market_data, watchlist)
    state.watchlist_scores = scores

    risk = await evaluate_risk(
        current_capital=growth.current_capital, tier=growth.current_tier,
        is_proven=growth.is_proven, progress_pct_to_next_tier=growth.progress_pct_to_next_tier,
    )
    state.risk_state = risk

    events_today = None
    if ENABLE_ENGINE13_EVENTS:
        er = evaluate_event_risk()
        if er.events_today:
            events_today = er.events_today

    yesterday_pnl = None
    yesterday_drag = None
    yesterday_verdict = None
    if ENABLE_ENGINE18_COACH:
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        try:
            async with get_db() as db:
                row = await db.execute(
                    "SELECT net_pnl, total_charges, gross_pnl FROM daily_summary WHERE date = ?",
                    (yesterday,),
                )
                data = await row.fetchone()
                if data and data["net_pnl"] is not None:
                    yesterday_pnl = data["net_pnl"]
                    gross = data["gross_pnl"] or 0
                    charges = data["total_charges"] or 0
                    yesterday_drag = (charges / abs(gross) * 100) if abs(gross) > 0 else 0
                    yesterday_verdict = f"{'+'if yesterday_pnl >= 0 else ''}₹{yesterday_pnl:.0f} net"
        except Exception:
            pass

    # --- AI-ENHANCED MORNING BRIEF ---
    ai_summary = None
    try:
        from tradepilot.layer2.engine_ai import ai_morning_brief
        from tradepilot.layer2.engine27_news import _news_cache

        # Get news mood
        news_mood = "NEUTRAL"
        if _news_cache and _news_cache.overall_mood:
            news_mood = _news_cache.overall_mood

        # Get VIX
        vix = 14.0
        try:
            vix = await state.market_data.get_vix()
        except Exception:
            pass

        # Top sectors from scores
        sector_counts: dict[str, int] = {}
        for s in scores:
            sector_counts[s.sector] = sector_counts.get(s.sector, 0) + 1
        top_sectors = sorted(sector_counts, key=sector_counts.get, reverse=True)[:3]

        ai_summary = await ai_morning_brief({
            "capital": growth.current_capital,
            "tier": growth.current_tier.value,
            "progress_pct": growth.progress_pct_to_next_tier,
            "risk_gate": risk.gate.value,
            "candidates": len(scores),
            "top_sectors": ", ".join(top_sectors) if top_sectors else "mixed",
            "news_mood": news_mood,
            "vix": vix,
            "yesterday_pnl": yesterday_pnl or 0,
            "yesterday_drag": yesterday_drag or 0,
            "events": ", ".join([e.get("name", "") for e in (events_today or [])]) or "None",
        })

        # FIX 8.3: Validate AI summary against actual data — check VIX claims
        if ai_summary:
            import re
            vix_matches = re.findall(r'[Vv][Ii][Xx].*?(\d+\.?\d*)', ai_summary)
            for v in vix_matches:
                try:
                    if abs(float(v) - vix) > 3:
                        ai_summary += f" [Note: Actual VIX is {vix:.1f}]"
                        break
                except ValueError:
                    pass
    except Exception as e:
        logger.debug("AI morning brief unavailable: %s", str(e)[:60])

    brief = build_morning_brief(
        growth_state=growth, watchlist_scores=scores,
        risk_gate=risk.gate, risk_reason=risk.reason,
        trades_remaining=risk.trades_remaining,
        events_today=events_today, yesterday_pnl=yesterday_pnl,
        yesterday_charge_drag=yesterday_drag, yesterday_verdict=yesterday_verdict,
        ai_summary=ai_summary,
    )
    state.morning_brief = brief
    logger.info("Morning brief generated: %s", brief.one_line_summary[:80])
    return brief


def _intake_to_dict(parsed: ParsedIntake) -> dict:
    return {
        "intent": parsed.intent, "ticker": parsed.ticker,
        "price": parsed.price, "qty": parsed.qty,
        "confidence": parsed.confidence, "ambiguous_fields": parsed.ambiguous_fields,
    }
