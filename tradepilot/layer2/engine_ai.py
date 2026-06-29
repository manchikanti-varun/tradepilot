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
GROQ_API_KEY_2 = os.environ.get("GROQ_API_KEY_2", "")  # Second key for the 70B model


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

    # FIX 8.1: Log prompt version for drift detection
    from tradepilot.layer2.prompts import PROMPT_VERSION
    logger.debug("ai_quick_json call (prompt_version=%s)", PROMPT_VERSION)

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


# FIX 8.4: Valid loss causes for validation
VALID_LOSS_CAUSES = {
    "LATE_ENTRY", "HELD_TOO_LONG", "WRONG_SECTOR", "NEWS_REVERSAL",
    "CHARGE_DRAG", "WEAK_SETUP_OVERRIDE", "REGIME_MISMATCH",
}


async def ai_classify_loss(trade_data: dict) -> Optional[dict]:
    """AI-powered loss classification for a single trade.
    
    Returns: {"primary_cause": "...", "reasoning": "...", "fix": "..."}
    FIX 8.4: Validates primary_cause and sanitizes text fields.
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

    result = await ai_quick_json(prompt, max_tokens=200)
    if result:
        # FIX 8.4: Validate primary_cause against allowed set
        cause = result.get("primary_cause", "").upper().replace(" ", "_")
        if cause not in VALID_LOSS_CAUSES:
            result["primary_cause"] = "UNCLASSIFIED"
            result["original_ai_cause"] = cause
        else:
            result["primary_cause"] = cause
        # FIX 8.4: Sanitize text fields to max 200 chars
        result["reasoning"] = (result.get("reasoning") or "")[:200]
        result["fix"] = (result.get("fix") or "")[:200]
    return result


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
    """Build comprehensive analysis prompt — AI sees everything including news.
    FIX 8.2: Cap news_context at 600 chars and price_history at 400 chars to prevent truncation."""
    price_history = data.get('price_history', 'Not available')
    news_context = data.get('news_context', 'No recent news available for this stock.')

    # FIX 8.2: Token budget management — prevent context window overflow
    if len(news_context) > 600:
        news_context = news_context[:597] + "..."
    if len(price_history) > 400:
        price_history = price_history[:397] + "..."

    return f"""You are a professional intraday trader analyzing NSE India stocks. Give a complete trading analysis.

STOCK: {symbol}
CURRENT PRICE: ₹{data.get('ltp', 0)}

TODAY'S DATA:
- Day High: ₹{data.get('day_high', 0)}
- Day Low: ₹{data.get('day_low', 0)}
- VWAP: ₹{data.get('vwap', 0)}
- Volume vs Average: {data.get('volume_ratio', 1.0)}x

RECENT PRICE ACTION (MOST IMPORTANT - CHECK THIS FIRST):
- Last 30-min trend: {data.get('recent_trend', 'UNKNOWN')}
- Drop from 30-min high: {data.get('drop_from_30m_high_pct', 0)}%
- 30-min high was: ₹{data.get('recent_30m_high', 0)}
- Red candles in last 3: {data.get('last_3_candles_red', 0)} out of 3
- RULE: If stock is FALLING or dropped >0.5% from recent high, you MUST say WAIT. Never buy a falling stock.

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

ANALYZE THIS STOCK. Your #1 priority is RECENT PRICE ACTION — is it going UP or DOWN right now?

CRITICAL RULES:
- If recent_trend is FALLING → action MUST be "WAIT"
- If drop_from_30m_high > 0.5% → action MUST be "WAIT"
- If 2+ red candles in last 3 → action MUST be "WAIT"
- Only say "BUY" if the stock is RISING or SIDEWAYS near support

Respond ONLY in this JSON format:
{{
  "action": "BUY" or "SELL" or "WAIT",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "entry_price": exact price to enter,
  "stop_loss": exact stop loss price,
  "target_1": first target price,
  "target_2": second target price,
  "risk_reward": number like 1.5 or 2.0,
  "reasoning": "3-4 sentences. Start with whether the stock is currently rising or falling. Then explain key levels and risks."
}}"""


# FIX 2.3: Both models run on Groq (Llama 3.3 70B + Llama 4 Scout).
# They are NOT provider-independent. If Groq is down, dual-confirmation is unavailable.
# Previously misnamed "analyze_with_gemini" — renamed for clarity.

async def analyze_with_scout(symbol: str, data: dict) -> Optional[dict]:
    """Get analysis from Llama 4 Scout via Groq (second model for agreement check)."""
    if not GROQ_API_KEY:
        return None

    prompt = _build_prompt(symbol, data)
    url = "https://api.groq.com/openai/v1/chat/completions"

    payload = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
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
                    logger.warning("Groq Scout returned %d: %s", resp.status, body[:200])
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not text:
            return None
        return _parse_ai_response(text, "Groq-Scout")

    except asyncio.TimeoutError:
        logger.warning("Groq Scout timed out")
        return None
    except Exception as e:
        logger.warning("Groq Scout failed: %s", str(e)[:100])
        return None


# Keep backward-compatible alias
analyze_with_gemini = analyze_with_scout


async def analyze_with_groq(symbol: str, data: dict) -> Optional[dict]:
    """Get analysis from Groq AI (Llama 3.3 70B). Uses GROQ_API_KEY_2 if available."""
    # Use second key if available, otherwise fall back to primary
    api_key = GROQ_API_KEY_2 or GROQ_API_KEY
    if not api_key:
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
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=25)) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.warning("Groq API returned %d: %s", resp.status, body[:200])
                    return None
                result = await resp.json()

        text = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        return _parse_ai_response(text, "Groq")

    except asyncio.TimeoutError:
        logger.warning("Groq 70B timed out (25s)")
        return None
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
    # Run both models — parallel if using separate keys, sequential if same key
    if GROQ_API_KEY_2 and GROQ_API_KEY_2 != GROQ_API_KEY:
        # Separate keys = safe to run in parallel (no rate limit collision)
        results = await asyncio.gather(
            analyze_with_scout(symbol, data),
            analyze_with_groq(symbol, data),
            return_exceptions=True,
        )
        gemini_result = results[0] if not isinstance(results[0], Exception) else None
        groq_result = results[1] if not isinstance(results[1], Exception) else None
    else:
        # Same key = stagger to avoid rate limit
        gemini_result = await analyze_with_scout(symbol, data)
        await asyncio.sleep(1)
        groq_result = await analyze_with_groq(symbol, data)

    # Handle None results (function returns None on failure)
    # No need to check for exceptions since we're not using gather with return_exceptions

    # Determine final verdict
    gemini_action = gemini_result.get("action", "WAIT") if gemini_result else "UNAVAILABLE"
    groq_action = groq_result.get("action", "WAIT") if groq_result else "UNAVAILABLE"

    # Both agree on BUY
    if gemini_action == "BUY" and groq_action == "BUY":
        # FIX 2.1: Check entry price divergence — directional agreement alone is not enough
        g_entry = gemini_result.get("entry_price", 0) if gemini_result else 0
        q_entry = groq_result.get("entry_price", 0) if groq_result else 0
        if g_entry > 0 and q_entry > 0:
            price_divergence_pct = abs(g_entry - q_entry) / min(g_entry, q_entry) * 100
            if price_divergence_pct > 0.5:
                verdict = "CONFLICTING"
                confidence = "LOW"
            else:
                verdict = "CONFIRMED_BUY"
                confidence = "HIGH"
        else:
            verdict = "CONFIRMED_BUY"
            confidence = "HIGH"
    # Both agree on WAIT/SELL
    elif gemini_action in ("WAIT", "SELL") and groq_action in ("WAIT", "SELL"):
        verdict = "CONFIRMED_WAIT"
        confidence = "HIGH"
    # One says BUY, other says WAIT — they disagree
    elif (gemini_action == "BUY" and groq_action == "WAIT") or (groq_action == "BUY" and gemini_action == "WAIT"):
        verdict = "CONFLICTING"
        confidence = "LOW"
    # One says BUY, other says SELL — strong disagreement
    elif (gemini_action == "BUY" and groq_action == "SELL") or (groq_action == "BUY" and gemini_action == "SELL"):
        verdict = "CONFLICTING"
        confidence = "LOW"
    # ANY case where one model is UNAVAILABLE — single opinion = LOW confidence
    elif "UNAVAILABLE" in (gemini_action, groq_action):
        available_action = gemini_action if groq_action == "UNAVAILABLE" else groq_action
        if available_action == "BUY":
            verdict = "UNCONFIRMED_BUY"
        elif available_action in ("WAIT", "SELL"):
            verdict = "UNCONFIRMED_WAIT"
        else:
            verdict = "NO_SIGNAL"
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

    # FIX 2.4: Persist per-model outputs for drift detection
    try:
        from tradepilot.database import get_db
        async with get_db() as db:
            await db.execute(
                """INSERT INTO ai_analysis_log
                (timestamp, symbol, model_1_action, model_1_confidence, model_2_action, model_2_confidence, verdict)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (datetime.now().isoformat(), symbol,
                 groq_action, groq_result.get("confidence") if groq_result else None,
                 gemini_action, gemini_result.get("confidence") if gemini_result else None,
                 verdict),
            )
            await db.commit()
    except Exception:
        pass  # Non-critical — don't block analysis

    # FIX 6.4: Track how many models responded for degradation awareness
    models_responded = sum(1 for x in [gemini_result, groq_result] if x is not None)
    is_degraded = gemini_result is None or groq_result is None

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
        "models_responded": models_responded,
        "is_degraded": is_degraded,
    }
