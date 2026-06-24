"""Engine 6: Capital Allocation — tier + growth-stage aware sizing SUGGESTION."""

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
    Compute position size suggestion.
    Output is a card shown to the user — never triggers an order.

    HARD FLOOR: max_risk_pct is ALWAYS sourced from TIER_CONFIGS based on
    is_proven status. There is no parameter, config file, or settings override
    that can raise it above the unproven level when is_proven=False.
    This is enforced here structurally, not by policy.
    """
    tier_config = TIER_CONFIGS[tier]

    # HARD FLOOR — is_proven is the ONLY input that controls this choice.
    # Engine 24's validation is the ONLY path that sets is_proven=True.
    # POST /api/settings cannot change this — it has no code path to do so.
    max_risk_pct = tier_config.max_risk_pct_proven if is_proven else tier_config.max_risk_pct_unproven

    # Leverage (drops in HIGH_VOL)
    leverage = tier_config.leverage
    if market_mode == MarketMode.HIGH_VOL:
        leverage = 3.0

    # Allocation percentage by grade
    if grade == Grade.A_PLUS:
        allocation_pct = 0.80
    elif grade == Grade.A:
        allocation_pct = 0.60
    else:
        allocation_pct = 0.40  # shouldn't reach here (only A+/A pass Engine 5)

    # HIGH_VOL caps at 40%
    if market_mode == MarketMode.HIGH_VOL:
        allocation_pct = min(allocation_pct, 0.40)

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

    # Stop loss calculation
    stop_loss_amount = (qty * ltp) * (max_risk_pct / 100 / leverage)
    stop_price = ltp - (stop_loss_amount / qty) if qty > 0 else 0

    # If near tier boundary, Engine 11's tighter daily-loss multiplier applies
    # (handled by Engine 11, not here — we just note it)
    near_boundary_note = ""
    if progress_pct_to_next_tier >= 85:
        near_boundary_note = " [Near tier boundary — daily loss limit tightened]"

    message = (
        f"Suggested qty: {qty} @ ~₹{ltp:.2f} — place this yourself in Angel One."
        f" Stop: ₹{stop_price:.2f} | Risk: ₹{stop_loss_amount:.2f} ({max_risk_pct}%)"
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
