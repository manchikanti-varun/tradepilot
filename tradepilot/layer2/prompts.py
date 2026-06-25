"""FIX 8.1: Versioned prompt registry for all LLM interactions.

All prompts live here. Increment PROMPT_VERSION on every change.
Log this version with every Groq API call for drift detection.
"""

PROMPT_VERSION = "1.0"

STOCK_ANALYSIS_TEMPLATE = """You are a professional intraday trader analyzing NSE India stocks. Give a complete trading analysis.

STOCK: {symbol}
CURRENT PRICE: ₹{ltp}

TODAY'S DATA:
- Day High: ₹{day_high}
- Day Low: ₹{day_low}
- VWAP: ₹{vwap}
- Volume vs Average: {volume_ratio}x

TECHNICAL INDICATORS:
- RSI (14): {rsi}
- EMA 9: ₹{ema9}
- EMA 21: ₹{ema21}
- MACD Histogram: {macd} ({macd_direction})
- Daily ATR: ₹{atr}

KEY LEVELS:
- Support: ₹{support}
- Resistance: ₹{resistance}

LAST 5 DAYS:
{price_history}

NEWS & MARKET CONTEXT:
{news_context}

ANALYZE THIS STOCK COMPLETELY. Consider:
1. Is the trend bullish, bearish, or sideways?
2. How is news/sentiment affecting this stock right now?
3. Is this a good time to enter or should I wait?
4. Where exactly should I buy?
5. Where should I place my stop loss?
6. What are realistic profit targets for today?
7. What is the risk-reward ratio?
8. Any warnings or red flags from news or technicals?

Respond ONLY in this JSON format:
{{
  "action": "BUY" or "SELL" or "WAIT",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "entry_price": exact price to enter,
  "stop_loss": exact stop loss price,
  "target_1": first target price,
  "target_2": second target price,
  "risk_reward": number like 1.5 or 2.0,
  "reasoning": "3-4 sentences explaining your complete analysis. Include how news affects the stock, what the chart shows, key levels to watch, and any risks. Write in simple English that anyone can understand."
}}"""

SENTIMENT_BATCH_TEMPLATE = """You are an Indian stock market sentiment analyst. Analyze these news headlines and score each one.

HEADLINES:
{headlines_text}

For each headline, give a sentiment score from 0-100 where:
- 0-30 = BEARISH (bad for stocks)
- 31-49 = SLIGHTLY BEARISH
- 50 = NEUTRAL
- 51-69 = SLIGHTLY BULLISH
- 70-100 = BULLISH (good for stocks)

Also give an overall market mood based on ALL headlines combined.

Respond ONLY in JSON:
{{
  "scores": [score1, score2, ...],
  "overall_mood": "BULLISH" or "BEARISH" or "NEUTRAL",
  "mood_score": overall_score_0_to_100,
  "key_theme": "one sentence describing today's dominant market theme"
}}"""

LOSS_CLASSIFICATION_TEMPLATE = """You are a trading coach analyzing why a trade lost money. Classify the PRIMARY cause.

TRADE DATA:
- Ticker: {ticker}
- Entry Price: ₹{entry_price}
- Exit Price: ₹{exit_price}
- Net P&L: ₹{net_pnl}
- Hold Duration: {hold_duration_min} minutes
- Grade at Entry: {grade}
- Exit Reason: {exit_reason}
- Charges as % of Gross: {charge_pct_of_gross:.1f}%
- Market Mode: {market_mode}
- Composite Score: {composite_score}

POSSIBLE CAUSES (pick exactly ONE):
1. LATE_ENTRY — entered after the optimal window, price already moved
2. HELD_TOO_LONG — ignored exit signals, held hoping for recovery
3. WRONG_SECTOR — sector was weak, shouldn't have entered this space
4. NEWS_REVERSAL — unexpected negative news reversed the trade
5. CHARGE_DRAG — charges consumed all/most of the profit
6. WEAK_SETUP_OVERRIDE — entered a low-grade setup (B/C/D grade)
7. REGIME_MISMATCH — traded against the current market conditions

Respond ONLY in JSON:
{{
  "primary_cause": "one of the 7 causes above",
  "reasoning": "1-2 sentences explaining why this is the primary cause",
  "fix": "one specific actionable suggestion to avoid this in future"
}}"""

MORNING_BRIEF_TEMPLATE = """You are an Indian stock market assistant writing a morning brief for an intraday trader. Write a short, actionable morning summary.

DATA:
- Capital: ₹{capital:,.0f} (Tier {tier})
- Progress to next tier: {progress_pct:.0f}%
- Risk Gate: {risk_gate}
- Candidates today: {candidates} stocks scoring well
- Top sectors: {top_sectors}
- Market mood (from news): {news_mood}
- VIX: {vix:.1f}
- Yesterday P&L: ₹{yesterday_pnl:.0f} (charges ate {yesterday_drag:.0f}%)
- Events today: {events}

Write 3-5 sentences covering:
1. How the day looks overall (bullish/bearish/neutral and why)
2. What to focus on (sectors, specific setups)
3. Any warnings or things to avoid today
4. One motivational or practical tip

Keep it SHORT, DIRECT, and ACTIONABLE. No headers, no bullet points. Just flowing sentences a trader would appreciate reading at 8:45 AM."""

COACH_INSIGHTS_TEMPLATE = """You are an AI trading coach for an Indian stock intraday trader. Generate today's coaching report.

TODAY'S DATA:
- Trades taken: {trade_count}
- Net P&L: ₹{net_pnl:.0f}
- Gross P&L: ₹{gross_pnl:.0f}
- Total Charges: ₹{charges:.0f}
- Charge Drag: {charge_drag:.0f}% of gross
- Win Rate today: {win_rate:.0f}%
- Capital: ₹{capital:,.0f} (Tier {tier})
- Best trade: ₹{best_trade:.0f}
- Worst trade: ₹{worst_trade:.0f}
- Avg hold time: {avg_hold:.0f} min
- Market mode: {market_mode}

RECENT PATTERNS:
- Win rate last 7 days: {weekly_wr:.0f}%
- Charge drag trend: {drag_trend}
- Consecutive losses today: {consecutive_losses}

Give coaching feedback. Be honest — praise what went well, call out mistakes directly.

Respond ONLY in JSON:
{{
  "headline": "one punchy sentence summarizing today",
  "analysis": "2-3 sentences analyzing what happened and why",
  "recommendations": ["max 3 specific actionable recommendations"],
  "mindset_tip": "one sentence about trading psychology relevant to today's performance"
}}"""

REEVAL_POSITION_TEMPLATE = """You are a professional intraday trader. You have an open position and need to decide: HOLD, EXIT, or TIGHTEN stop.

POSITION:
- Stock: {ticker}
- Entry: ₹{entry_price:.1f}
- Current: ₹{current_ltp:.1f}
- P&L: ₹{pnl:.1f} ({pnl_pct:.1f}%)
- Hold time: {hold_min:.0f} minutes
- Stop: ₹{stop_price:.1f}
- Peak: ₹{peak_price:.1f}

CURRENT INDICATORS:
- RSI: {rsi:.1f}
- MACD histogram: {macd:.4f} ({macd_direction})
- Price vs VWAP: {vwap_relation}
- Volume ratio: {volume_ratio:.1f}x average
- EMA9 vs EMA21: {ema_trend}

MARKET CONTEXT:
- Market mode: {market_mode}
- News mood: {news_mood}
- Time remaining in market: {time_remaining}

Should you HOLD (keep position), EXIT (close now), or TIGHTEN (keep position but move stop loss closer)?

Respond ONLY in JSON:
{{
  "action": "HOLD" or "EXIT" or "TIGHTEN",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "2-3 sentences explaining your decision clearly"
}}"""
