"""Engine 7: Trade Simulator — THE CHARGE GATE. Non-negotiable, even in MVP."""

from dataclasses import dataclass

from tradepilot.config import CHARGE_GATE_MAX_BREAKEVEN_PCT, CHARGE_GATE_MIN_RR
from tradepilot.layer2.engine8_charges import calculate_angel_charges


@dataclass
class SimulationScenario:
    label: str  # "best", "avg", "worst"
    target_price: float
    gross_pnl: float
    charges: float
    net_pnl: float
    net_pct: float


@dataclass
class SimulationResult:
    best: SimulationScenario
    avg: SimulationScenario
    worst: SimulationScenario
    min_profitable_move_pct: float
    risk_reward: float
    passed: bool
    block_reason: str | None
    message: str


def simulate_trade(
    ltp: float,
    qty: int,
    atr: float,
    capital_to_use: float,
    stop_price: float,
) -> SimulationResult:
    """
    Simulate best/avg/worst scenarios with charges.
    HARD BLOCK if:
    - avg_net <= 0
    - risk_reward < 1.0
    - min_profitable_move_pct > 1.8%
    - avg_net < charges_at_avg * 0.5
    """
    if qty == 0 or atr <= 0:
        return SimulationResult(
            best=SimulationScenario("best", 0, 0, 0, 0, 0),
            avg=SimulationScenario("avg", 0, 0, 0, 0, 0),
            worst=SimulationScenario("worst", 0, 0, 0, 0, 0),
            min_profitable_move_pct=999,
            risk_reward=0,
            passed=False,
            block_reason="Invalid qty or ATR",
            message="Cannot simulate — invalid parameters.",
        )

    # Target prices
    best_target = ltp + atr * 0.9
    avg_target = ltp + atr * 0.35
    worst_target = stop_price  # stop hit

    scenarios = []
    for label, target in [("best", best_target), ("avg", avg_target), ("worst", worst_target)]:
        gross = qty * (target - ltp)
        charges, _ = calculate_angel_charges(qty, ltp, target)
        net = gross - charges
        net_pct = (net / capital_to_use * 100) if capital_to_use > 0 else 0
        scenarios.append(SimulationScenario(
            label=label,
            target_price=round(target, 2),
            gross_pnl=round(gross, 2),
            charges=round(charges, 2),
            net_pnl=round(net, 2),
            net_pct=round(net_pct, 2),
        ))

    best_sc, avg_sc, worst_sc = scenarios

    # Min profitable move percentage
    # charges at avg scenario / actual exposure
    actual_exposure = qty * ltp
    charges_at_avg = avg_sc.charges
    min_profitable_move_pct = (charges_at_avg / actual_exposure * 100) if actual_exposure > 0 else 999

    # Risk:Reward ratio (avg profit / max loss)
    max_loss = abs(worst_sc.net_pnl) if worst_sc.net_pnl < 0 else 1.0
    risk_reward = avg_sc.net_pnl / max_loss if max_loss > 0 else 0

    # HARD BLOCK checks
    block_reason = None
    if avg_sc.net_pnl <= 0:
        block_reason = "Profit eaten by charges"
    elif risk_reward < CHARGE_GATE_MIN_RR:
        block_reason = "Risk:reward unfavorable"
    elif min_profitable_move_pct > CHARGE_GATE_MAX_BREAKEVEN_PCT:
        block_reason = "Too expensive to break even"
    elif avg_sc.net_pnl < (charges_at_avg * 0.5):
        block_reason = "Edge too thin vs charges"

    passed = block_reason is None

    if passed:
        message = (
            f"Net after charges: ₹{avg_sc.net_pnl:.2f} | "
            f"Needs {min_profitable_move_pct:.1f}% move to break even | "
            f"R:R {risk_reward:.2f}"
        )
    else:
        message = f"BLOCKED — {block_reason} (breakeven needs {min_profitable_move_pct:.1f}% move)"

    return SimulationResult(
        best=best_sc,
        avg=avg_sc,
        worst=worst_sc,
        min_profitable_move_pct=round(min_profitable_move_pct, 2),
        risk_reward=round(risk_reward, 2),
        passed=passed,
        block_reason=block_reason,
        message=message,
    )
