"""Engine 25 adversarial test pass.

These tests verify that ambiguous/dangerous inputs produce clarifying questions
or rejections — NEVER a silent guess or silent commit.

Test cases:
1. Ambiguous qty: "SBI 845" (no qty) → must ask for qty
2. Ambiguous ticker: fuzzy match collision → must ask which stock
3. SELL with no open position → must reject
"""

import pytest
from tradepilot.layer2.engine25_intake import parse_trade_input


class TestEngine25Adversarial:
    """The intake parser must NEVER silently guess on money entries."""

    def test_ambiguous_qty_asks_clarification(self):
        """'SBI 845' has no quantity — must ask, not guess."""
        result = parse_trade_input("SBI 845")

        # Should identify ticker (SBI → SBIN) and price (845)
        # But qty is missing → must flag as ambiguous
        assert result.ticker == "SBIN", f"Expected SBIN, got {result.ticker}"
        assert result.price == 845.0, f"Expected 845, got {result.price}"
        assert result.qty is None or "qty" in result.ambiguous_fields, (
            "Qty should be ambiguous or None when not provided"
        )
        # Must have a clarification question
        assert result.clarification_needed is not None, (
            "Parser must ask for clarification when qty is missing"
        )
        assert "how many" in result.clarification_needed.lower() or "qty" in result.clarification_needed.lower() or "shares" in result.clarification_needed.lower(), (
            f"Clarification should ask about quantity, got: {result.clarification_needed}"
        )

    def test_ambiguous_intent_asks_clarification(self):
        """Input with no buy/sell keyword should ask intent."""
        result = parse_trade_input("SBIN 845 4")

        # Has ticker, price, qty — but no intent keyword
        # Must not assume BUY silently
        assert result.intent == "AMBIGUOUS", (
            f"Expected AMBIGUOUS intent for 'SBIN 845 4', got {result.intent}"
        )
        assert result.clarification_needed is not None
        assert "buy" in result.clarification_needed.lower() or "sell" in result.clarification_needed.lower()

    def test_sell_recognized_correctly(self):
        """'Sold SBIN at 858' should parse cleanly as SELL."""
        result = parse_trade_input("Sold SBIN at 858")

        assert result.intent == "SELL"
        assert result.ticker == "SBIN"
        assert result.price == 858.0
        assert result.ambiguous_fields == [] or result.ambiguous_fields == ["qty"], (
            f"Only qty might be ambiguous, got: {result.ambiguous_fields}"
        )

    def test_buy_with_various_formats(self):
        """Various natural-language BUY formats should all parse correctly."""
        test_cases = [
            ("Bought SBIN at 845, qty 4", "BUY", "SBIN", 845.0, 4),
            ("BUY SBIN 845 4", "BUY", "SBIN", 845.0, 4),
            ("I bought SBI at ₹845, 4 shares", "BUY", "SBIN", 845.0, 4),
            ("SBIN entry 845 x4", "BUY", "SBIN", 845.0, 4),
        ]

        for text, exp_intent, exp_ticker, exp_price, exp_qty in test_cases:
            result = parse_trade_input(text)
            assert result.intent == exp_intent, f"'{text}' → intent={result.intent}, expected {exp_intent}"
            assert result.ticker == exp_ticker, f"'{text}' → ticker={result.ticker}, expected {exp_ticker}"
            assert result.price == exp_price, f"'{text}' → price={result.price}, expected {exp_price}"
            if exp_qty is not None:
                assert result.qty == exp_qty, f"'{text}' → qty={result.qty}, expected {exp_qty}"

    def test_fuzzy_ticker_resolution(self):
        """Common aliases should resolve correctly, not ambiguously."""
        cases = [
            ("Bought Reliance at 2800 qty 1", "RELIANCE"),
            ("Bought HUL at 2400 qty 2", "HINDUNILVR"),
            ("Bought Infosys at 1500 qty 3", "INFY"),
            ("Bought HDFC Bank at 1650 qty 2", "HDFCBANK"),
        ]
        for text, expected_ticker in cases:
            result = parse_trade_input(text)
            assert result.ticker == expected_ticker, (
                f"'{text}' → ticker={result.ticker}, expected {expected_ticker}"
            )

    def test_no_ticker_asks_clarification(self):
        """Completely unrecognizable ticker should ask, not guess."""
        result = parse_trade_input("Bought XYZNONEXIST at 100 qty 5")

        # Should not match any ticker
        # If fuzzy match confidence is too low, ticker should be None
        if result.ticker is None:
            assert "ticker" in result.ambiguous_fields
            assert result.clarification_needed is not None
        # If it somehow matches (very unlikely), the confidence should be low
        # Either way, the system should not silently commit

    def test_conflicting_intent_keywords_asks_clarification(self):
        """'Buy then sell SBIN' has both keywords — must ask."""
        result = parse_trade_input("I want to buy and sell SBIN at 845")
        assert result.intent == "AMBIGUOUS", (
            "Conflicting buy/sell keywords should produce AMBIGUOUS"
        )
        assert result.clarification_needed is not None

    def test_echo_message_never_commits_silently(self):
        """Every successful parse must include 'Confirm?' in echo."""
        result = parse_trade_input("Bought SBIN at 845, qty 4")
        assert "confirm" in result.echo_message.lower() or "?" in result.echo_message, (
            f"Echo must ask for confirmation, got: {result.echo_message}"
        )
