"""AI Analysis Engine — Dual LLM strategy for stock analysis.

Uses Gemini + Groq (two different AI models) to analyze stocks independently.
When both agree = HIGH confidence. One agrees = MEDIUM. Both disagree = SKIP.

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

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def _build_prompt(symbol: str, data: dict) -> str:
    """Build comprehensive analysis prompt — AI sees everything and decides."""
    price_history = data.get('price_history', 'Not available')

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

ANALYZE THIS STOCK COMPLETELY. Consider:
1. Is the trend bullish, bearish, or sideways?
2. Is this a good time to enter or should I wait?
3. Where exactly should I buy?
4. Where should I place my stop loss?
5. What are realistic profit targets for today?
6. What is the risk-reward ratio?
7. Any warnings or red flags?

Respond ONLY in this JSON format:
{{
  "action": "BUY" or "SELL" or "WAIT",
  "confidence": "HIGH" or "MEDIUM" or "LOW",
  "entry_price": exact price to enter,
  "stop_loss": exact stop loss price,
  "target_1": first target price,
  "target_2": second target price,
  "risk_reward": number like 1.5 or 2.0,
  "reasoning": "3-4 sentences explaining your complete analysis in simple language. Why buy/wait, what the chart is showing, key levels to watch, and any risks."
}}"""


async def analyze_with_gemini(symbol: str, data: dict) -> Optional[dict]:
    """Get analysis from Gemini AI."""
    if not GEMINI_API_KEY:
        return None

    prompt = _build_prompt(symbol, data)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                if resp.status != 200:
                    logger.warning("Gemini API returned %d", resp.status)
                    return None
                result = await resp.json()

        text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        # Extract JSON from response
        return _parse_ai_response(text, "Gemini")

    except Exception as e:
        logger.warning("Gemini analysis failed: %s", str(e)[:100])
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
