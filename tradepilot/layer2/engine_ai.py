"""AI Analysis Engine — Dual LLM strategy for stock analysis.

Uses Gemini + Groq (two different AI models) to analyze stocks independently.
When both agree = HIGH confidence. One agrees = MEDIUM. Both disagree = SKIP.

Also provides utility functions for AI-powered features across all engines:
- ai_quick_json(): Fast JSON response from Groq for structured outputs
- ai_analyze_text(): Quick text analysis (sentiment, classification)
- ai_generate_prose(): Natural language generation (briefs, coaching)

Free APIs:
- Gemini (Google): 60 calls/min
- Groq (Llama/Mixtral): 30 calls/min
"""

import asyncio
import logging
import os
import json
from datetime import datetime
from typing import Optional

import aiohttp

logger = logging.getLogger(__name__)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


# ═══════════════════════════════════════════════════════════════
# SHARED AI UTILITIES — Used by all engines
# ═══════════════════════════════════════════════════════════════

async def ai_quick_json(prompt: str, max_tokens: int = 500, temperature: float = 0.2) -> Optional[dict]:
    """Fast structured JSON response from Groq. Returns None on failure.
    
    Use this when you need a structured response (scores, classifications, etc.)
    Falls back gracefully — caller must handle None.
    """
    if not GROQ_API_KEY:
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status != 200:
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _parse_ai_response(text, "Groq-Quick")
    except Exception as e:
        logger.debug("ai_quick_json failed: %s", str(e)[:80])
        return None


async def ai_generate_prose(prompt: str, max_tokens: int = 400, temperature: float = 0.5) -> Optional[str]:
    """Generate natural language text from Groq. Returns None on failure.
    
    Use for briefs, coaching messages, explanations.
    """
    if not GROQ_API_KEY:
        return None

    url = "https://api.groq.com/openai/v1/chat/completions"
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=12)) as resp:
                if resp.status != 200:
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return text.strip() if text else None
    except Exception as e:
        logger.debug("ai_generate_prose failed: %s", str(e)[:80])
        return None


async def ai_sentiment_batch(headlines: list[str]) -> Optional[dict]:
    """AI-powered sentiment analysis for a batch of headlines.
    
    Returns: {"scores": [0-100 per headline], "overall_mood": "BULLISH"/"BEARISH"/"NEUTRAL", "mood_score": 0-100}
    """
    if not GROQ_API_KEY or not headlines:
        return None

    headlines_text = "\n".join([f"{i+1}. {h}" for i, h in enumerate(headlines[:15])])

    prompt = f"""You are an Indian stock market sentiment analyst. Analyze these news headlines and score each one.

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

    return await ai_quick_json(prompt, max_tokens=300)


async def ai_classify_loss(trade_data: dict) -> Optional[dict]:
    """AI-powered loss classification for a single trade.
    
    Returns: {"primary_cause": "...", "reasoning": "...", "fix": "..."}
    """
    if not GROQ_API_KEY:
        return None

    prompt = f"""You are a trading coach analyzing why a trade lost money. Classify the PRIMARY cause.

TRADE DATA:
- Ticker: {trade_data.get('ticker', 'Unknown')}
- Entry Price: ₹{trade_data.get('entry_price', 0)}
- Exit Price: ₹{trade_data.get('exit_price', 0)}
- Net P&L: ₹{trade_data.get('net_pnl', 0)}
- Hold Duration: {trade_data.get('hold_duration_min', 0)} minutes
- Grade at Entry: {trade_data.get('grade', 'Unknown')}
- Exit Reason: {trade_data.get('exit_reason', 'Unknown')}
- Charges as % of Gross: {trade_data.get('charge_pct_of_gross', 0):.1f}%
- Market Mode: {trade_data.get('market_mode', 'NORMAL')}
- Composite Score: {trade_data.get('composite_score', 0)}

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

    return await ai_quick_json(prompt, max_tokens=200)


async def ai_morning_brief(data: dict) -> Optional[str]:
    """AI-generated morning brief summary.
    
    Returns a 3-5 sentence human-readable market outlook.
    """
    if not GROQ_API_KEY:
        return None

    prompt = f"""You are an Indian stock market assistant writing a morning brief for an intraday trader. Write a short, actionable morning summary.

DATA:
- Capital: ₹{data.get('capital', 0):,.0f} (Tier {data.get('tier', 'A')})
- Progress to next tier: {data.get('progress_pct', 0):.0f}%
- Risk Gate: {data.get('risk_gate', 'GO')}
- Candidates today: {data.get('candidates', 0)} stocks scoring well
- Top sectors: {data.get('top_sectors', 'mixed')}
- Market mood (from news): {data.get('news_mood', 'NEUTRAL')}
- VIX: {data.get('vix', 14):.1f}
- Yesterday P&L: ₹{data.get('yesterday_pnl', 0):.0f} (charges ate {data.get('yesterday_drag', 0):.0f}%)
- Events today: {data.get('events', 'None')}

Write 3-5 sentences covering:
1. How the day looks overall (bullish/bearish/neutral and why)
2. What to focus on (sectors, specific setups)
3. Any warnings or things to avoid today
4. One motivational or practical tip

Keep it SHORT, DIRECT, and ACTIONABLE. No headers, no bullet points. Just flowing sentences a trader would appreciate reading at 8:45 AM."""

    return await ai_generate_prose(prompt, max_tokens=250)


async def ai_coach_insights(data: dict) -> Optional[dict]:
    """AI-powered daily coaching insights.
    
    Returns: {"headline": "...", "analysis": "...", "recommendations": [...], "mindset_tip": "..."}
    """
    if not GROQ_API_KEY:
        return None

    prompt = f"""You are an AI trading coach for an Indian stock intraday trader. Generate today's coaching report.

TODAY'S DATA:
- Trades taken: {data.get('trade_count', 0)}
- Net P&L: ₹{data.get('net_pnl', 0):.0f}
- Gross P&L: ₹{data.get('gross_pnl', 0):.0f}
- Total Charges: ₹{data.get('charges', 0):.0f}
- Charge Drag: {data.get('charge_drag', 0):.0f}% of gross
- Win Rate today: {data.get('win_rate', 0):.0f}%
- Capital: ₹{data.get('capital', 0):,.0f} (Tier {data.get('tier', 'A')})
- Best trade: ₹{data.get('best_trade', 0):.0f}
- Worst trade: ₹{data.get('worst_trade', 0):.0f}
- Avg hold time: {data.get('avg_hold', 0):.0f} min
- Market mode: {data.get('market_mode', 'NORMAL')}

RECENT PATTERNS:
- Win rate last 7 days: {data.get('weekly_wr', 0):.0f}%
- Charge drag trend: {data.get('drag_trend', 'stable')}
- Consecutive losses today: {data.get('consecutive_losses', 0)}

Give coaching feedback. Be honest — praise what went well, call out mistakes directly.

Respond ONLY in JSON:
{{
  "headline": "one punchy sentence summarizing today (e.g. 'Good day but charges ate your profits')",
  "analysis": "2-3 sentences analyzing what happened and why",
  "recommendations": ["max 3 specific actionable recommendations"],
  "mindset_tip": "one sentence about trading psychology relevant to today's performance"
}}"""

    return await ai_quick_json(prompt, max_tokens=350)


async def ai_reeval_position(data: dict) -> Optional[dict]:
    """AI-powered position re-evaluation — should you hold or exit?
    
    Returns: {"action": "HOLD"/"EXIT"/"TIGHTEN", "confidence": "HIGH"/"MEDIUM"/"LOW", "reasoning": "..."}
    """
    if not GROQ_API_KEY:
        return None

    prompt = f"""You are a professional intraday trader. You have an open position and need to decide: HOLD, EXIT, or TIGHTEN stop.

POSITION:
- Stock: {data.get('ticker', '')}
- Entry: ₹{data.get('entry_price', 0):.1f}
- Current: ₹{data.get('current_ltp', 0):.1f}
- P&L: ₹{data.get('pnl', 0):.1f} ({data.get('pnl_pct', 0):.1f}%)
- Hold time: {data.get('hold_min', 0):.0f} minutes
- Stop: ₹{data.get('stop_price', 0):.1f}
- Peak: ₹{data.get('peak_price', 0):.1f}

CURRENT INDICATORS:
- RSI: {data.get('rsi', 50):.1f}
- MACD histogram: {data.get('macd', 0):.4f} ({'positive' if data.get('macd', 0) > 0 else 'negative'})
- Price vs VWAP: {'above' if data.get('above_vwap', True) else 'below'}
- Volume ratio: {data.get('volume_ratio', 1.0):.1f}x average
- EMA9 vs EMA21: {'bullish' if data.get('ema_bullish', True) else 'bearish'}

MARKET CONTEXT:
- Market mode: {data.get('market_mode', 'NORMAL')}
- News mood: {data.get('news_mood', 'NEUTRAL')}
- Time remaining in market: {data.get('time_remaining', '?')}

Should you HOLD (keep position), EXIT (close now), or TIGHTEN (keep position but move stop loss closer)?

Respond ONLY in JSON:
{{
  "action": "HOLD" or "EXIT" or "TIGHTEN",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "reasoning": "2-3 sentences explaining your decision clearly"
}}"""

    return await ai_quick_json(prompt, max_tokens=200)


def _build_prompt(symbol: str, data: dict) -> str:
    """Build comprehensive analysis prompt — AI sees everything including news."""
    price_history = data.get('price_history', 'Not available')
    news_context = data.get('news_context', 'No recent news available for this stock.')

    return f"""You are a professional intraday trader analyzing NSE India stocks. Give a complete trading analysis.

STOCK: {symbol}
CURRENT PRICE: ₹{data.get('ltp', 0)}

TODAY'S DATA:
- Day High: ₹{data.get('day_high', 0)}
- Day Low: ₹{data.get('day_low', 0)}
- VWAP: ₹{data.get('vwap', 0)}
- Volume vs Average: {data.get('volume_ratio', 1.0)}x

TECHNICAL INDICATORS:
- RSI (14): {data.get('rsi', 50)}
- EMA 9: ₹{data.get('ema9', 0)}
- EMA 21: ₹{data.get('ema21', 0)}
- MACD Histogram: {data.get('macd', 0)} ({'bullish' if data.get('macd', 0) > 0 else 'bearish'})
- Daily ATR: ₹{data.get('atr', 0)}

KEY LEVELS:
- Support: ₹{data.get('support', 0)}
- Resistance: ₹{data.get('resistance', 0)}

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


async def analyze_with_gemini(symbol: str, data: dict) -> Optional[dict]:
    """Get analysis from second AI — uses Groq with a different model for independent opinion."""
    if not GROQ_API_KEY:
        return None

    prompt = _build_prompt(symbol, data)
    url = "https://api.groq.com/openai/v1/chat/completions"

    payload = {
        "model": "llama-4-scout-17b-16e-instruct",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 600,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=20)) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Groq (second model) returned %d: %s", resp.status, body[:200])
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not text:
            return None
        return _parse_ai_response(text, "Groq-Scout")

    except asyncio.TimeoutError:
        logger.warning("Groq (second model) timed out")
        return None
    except Exception as e:
        logger.warning("Groq (second model) failed: %s", str(e)[:100])
        return None


async def analyze_with_groq(symbol: str, data: dict) -> Optional[dict]:
    """Get analysis from Groq AI (Llama model)."""
    if not GROQ_API_KEY:
        return None

    prompt = _build_prompt(symbol, data)
    url = "https://api.groq.com/openai/v1/chat/completions"

    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": 500,
    }

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning("Groq API returned %d", resp.status)
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _parse_ai_response(text, "Groq")

    except Exception as e:
        logger.warning("Groq analysis failed: %s", str(e)[:100])
        return None


def _parse_ai_response(text: str, source: str) -> Optional[dict]:
    """Parse JSON from AI response text."""
    try:
        # Try to find JSON in the response
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        # Find first { and last }
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            json_str = text[start:end]
            parsed = json.loads(json_str)
            parsed["source"] = source
            return parsed
    except (json.JSONDecodeError, IndexError, KeyError) as e:
        logger.warning("Failed to parse %s response: %s", source, str(e)[:80])
    return None


async def dual_ai_analysis(symbol: str, data: dict) -> dict:
    """Run both AIs in parallel, combine their opinions.
    
    Returns:
    - gemini: Gemini's analysis
    - groq: Groq's analysis
    - final_verdict: CONFIRMED_BUY / CONFIRMED_WAIT / CONFLICTING
    - confidence: HIGH / MEDIUM / LOW
    - combined_reasoning: merged explanation
    """
    # Run both in parallel
    gemini_result, groq_result = await asyncio.gather(
        analyze_with_gemini(symbol, data),
        analyze_with_groq(symbol, data),
        return_exceptions=True,
    )

    # Handle exceptions
    if isinstance(gemini_result, Exception):
        gemini_result = None
    if isinstance(groq_result, Exception):
        groq_result = None

    # Determine final verdict
    gemini_action = gemini_result.get("action", "WAIT") if gemini_result else "UNAVAILABLE"
    groq_action = groq_result.get("action", "WAIT") if groq_result else "UNAVAILABLE"

    # Both agree on BUY
    if gemini_action == "BUY" and groq_action == "BUY":
        verdict = "CONFIRMED_BUY"
        confidence = "HIGH"
    # Both agree on WAIT/SELL
    elif gemini_action in ("WAIT", "SELL") and groq_action in ("WAIT", "SELL"):
        verdict = "CONFIRMED_WAIT"
        confidence = "HIGH"
    # One says BUY, other unavailable
    elif gemini_action == "BUY" and groq_action == "UNAVAILABLE":
        verdict = "LIKELY_BUY"
        confidence = "MEDIUM"
    elif groq_action == "BUY" and gemini_action == "UNAVAILABLE":
        verdict = "LIKELY_BUY"
        confidence = "MEDIUM"
    # One says BUY, other says WAIT
    elif (gemini_action == "BUY" and groq_action == "WAIT") or (groq_action == "BUY" and gemini_action == "WAIT"):
        verdict = "CONFLICTING"
        confidence = "LOW"
    # One says BUY, other says SELL
    elif (gemini_action == "BUY" and groq_action == "SELL") or (groq_action == "BUY" and gemini_action == "SELL"):
        verdict = "CONFLICTING"
        confidence = "LOW"
    else:
        verdict = "NO_SIGNAL"
        confidence = "LOW"

    # Build combined reasoning
    reasons = []
    if gemini_result and gemini_result.get("reasoning"):
        reasons.append(f"Gemini: {gemini_result['reasoning']}")
    if groq_result and groq_result.get("reasoning"):
        reasons.append(f"Groq: {groq_result['reasoning']}")

    # Pick best entry/stop/target (from the BUY recommendation if any)
    best = gemini_result if gemini_action == "BUY" else groq_result if groq_action == "BUY" else gemini_result or groq_result

    return {
        "gemini": gemini_result,
        "groq": groq_result,
        "verdict": verdict,
        "confidence": confidence,
        "action": gemini_action if gemini_action != "UNAVAILABLE" else groq_action,
        "entry_price": best.get("entry_price") if best else None,
        "stop_loss": best.get("stop_loss") if best else None,
        "target_1": best.get("target_1") if best else None,
        "target_2": best.get("target_2") if best else None,
        "risk_reward": best.get("risk_reward") if best else None,
        "reasoning": reasons,
    }
