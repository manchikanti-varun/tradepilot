"""Engine 6: Capital Allocation — full conviction single-trade sizing.

Philosophy: ONE trade at a time, full capital when market is good.
- Grade A+ in NORMAL/TRENDING market → 100% capital deployed
- Grade A in NORMAL market → 100% capital deployed  
- Grade A+ in HIGH_VOL → 70% capital (slightly conservative)
- Grade A in HIGH_VOL → 50% capital (cautious but still in)
- Anything else → don't trade (handled upstream by Engine 5 grade filter)

This is NOT a diversification engine. It's a conviction engine.
If the system says BUY, it means go all-in on that single best pick.
"""

from dataclasses import dataclass

from tradepilot.config import (
    Grade, CapitalTier, MarketMode, TIER_CONFIGS,
)


@dataclass
class AllocationResult:
    capital_to_use: float
    exposure: float
    qty: int
    stop_price: float
    stop_loss_amount: float
    allocation_pct: float
    leverage: float
    max_risk_pct: float
    tier: CapitalTier
    message: str
    viable: bool


def compute_allocation(
    current_capital: float,
    tier: CapitalTier,
    grade: Grade,
    ltp: float,
    atr: float,
    market_mode: MarketMode = MarketMode.NORMAL,
    is_proven: bool = False,
    progress_pct_to_next_tier: float = 0.0,
) -> AllocationResult:
    """
    Compute position size — FULL CAPITAL single-trade approach.
    
    Logic: If the system found a Grade A/A+ stock AND market conditions
    are good, deploy full capital. This is one-trade-at-a-time with
    conviction. The protection comes from:
    1. Engine 11 risk gate (won't even get here if market is bad)
    2. Grade filter (only A+/A reach this point)
    3. Stop loss (limits downside per trade)
    
    Output is a card shown to the user — never triggers an order.
    """
    tier_config = TIER_CONFIGS[tier]

    # HARD FLOOR — is_proven controls max risk per trade
    max_risk_pct = tier_config.max_risk_pct_proven if is_proven else tier_config.max_risk_pct_unproven

    # Leverage — Angel One provides different margins per stock group
    # Large caps (Nifty 50): 5x, Mid caps: 3x-4x, Others: 2x-3x
    # For now: use 5x as default (most of our universe is Nifty 200 large/mid cap)
    leverage = tier_config.leverage
    if market_mode == MarketMode.HIGH_VOL:
        leverage = max(leverage - 2, 2.0)  # reduce leverage in volatile markets

    # ALLOCATION: Full capital for good setups, reduced only in HIGH_VOL
    if market_mode == MarketMode.HIGH_VOL:
        # Market is rough — be cautious
        if grade == Grade.A_PLUS:
            allocation_pct = 0.70  # Still mostly in for A+ even in vol
        else:
            allocation_pct = 0.50  # Cautious for A in volatile market
    else:
        # NORMAL or TRENDING — full send on conviction picks
        allocation_pct = 1.0  # Use entire capital

    capital_to_use = current_capital * allocation_pct
    exposure = capital_to_use * leverage
    qty = int(exposure // ltp)

    if qty == 0:
        return AllocationResult(
            capital_to_use=capital_to_use,
            exposure=exposure,
            qty=0,
            stop_price=0,
            stop_loss_amount=0,
            allocation_pct=allocation_pct,
            leverage=leverage,
            max_risk_pct=max_risk_pct,
            tier=tier,
            message="Capital insufficient at this price — try a lower-priced stock in the watchlist.",
            viable=False,
        )

    # Stop loss based on ATR — this is your protection
    stop_price = ltp - (atr * 0.4)
    stop_loss_amount = qty * (ltp - stop_price)

    # Cap stop loss to max_risk_pct of capital
    max_loss_allowed = current_capital * (max_risk_pct / 100)
    if stop_loss_amount > max_loss_allowed:
        # Reduce qty to fit within risk limit
        per_share_risk = ltp - stop_price
        if per_share_risk > 0:
            qty = int(max_loss_allowed / per_share_risk)
            stop_loss_amount = qty * per_share_risk
        if qty == 0:
            return AllocationResult(
                capital_to_use=capital_to_use, exposure=exposure, qty=0,
                stop_price=0, stop_loss_amount=0,
                allocation_pct=allocation_pct, leverage=leverage,
                max_risk_pct=max_risk_pct, tier=tier,
                message="Risk too high at this ATR — waiting for tighter setup.",
                viable=False,
            )

    # Near tier boundary note
    near_boundary_note = ""
    if progress_pct_to_next_tier >= 85:
        near_boundary_note = " [Near tier boundary — protect gains]"

    # FIX 4.3: Gap-down protection — cap exposure if gap scenario would exceed 20% capital loss
    gap_scenario_loss = qty * ltp * 0.05  # 5% gap below stop (circuit scenario)
    if gap_scenario_loss > current_capital * 0.20:
        qty = int((current_capital * 0.20) / (ltp * 0.05))
        stop_loss_amount = qty * (ltp - stop_price)
        if qty == 0:
            return AllocationResult(
                capital_to_use=capital_to_use, exposure=exposure, qty=0,
                stop_price=0, stop_loss_amount=0,
                allocation_pct=allocation_pct, leverage=leverage,
                max_risk_pct=max_risk_pct, tier=tier,
                message="Gap-down risk too high for current capital.",
                viable=False,
            )

    message = (
        f"BUY {qty} shares @ ~₹{ltp:.2f} — full conviction trade."
        f" Stop: ₹{stop_price:.2f} | Max risk: ₹{stop_loss_amount:.2f} ({max_risk_pct}% cap)"
        f"{near_boundary_note}"
    )

    return AllocationResult(
        capital_to_use=round(capital_to_use, 2),
        exposure=round(exposure, 2),
        qty=qty,
        stop_price=round(stop_price, 2),
        stop_loss_amount=round(stop_loss_amount, 2),
        allocation_pct=allocation_pct,
        leverage=leverage,
        max_risk_pct=max_risk_pct,
        tier=tier,
        message=message,
        viable=True,
    )
