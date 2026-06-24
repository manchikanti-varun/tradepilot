"""Engine 14: Opportunity Cost Optimizer — single-position priority selection.

With ≤1 position possible, the signal list is NEVER flat.
Priority #1 = the one highest calibrated_avg_net pick.
Switch recommendation only if gap - switch_cost > ₹30 AND hold > 15 min.
"""

from dataclasses import dataclass
from typing import Optional

from tradepilot.config import ENABLE_ENGINE14_OPPORTUNITY_COST
from tradepilot.layer2.engine8_charges import calculate_angel_charges


@dataclass
class OpportunityCostResult:
    priority_1_symbol: Optional[str]
    priority_1_net: float
    priority_2_symbol: Optional[str]
    priority_2_net: float
    switch_recommended: bool
    switch_reason: Optional[str]
    switch_cost: float  # exit current + enter new charges


def evaluate_opportunity_cost(
    signals: list,  # list of SignalCards sorted by avg_net descending
    active_trade: Optional[dict] = None,  # {ticker, entry_price, qty, current_ltp, hold_min}
) -> OpportunityCostResult:
    """
    Determine Priority #1 signal and whether to recommend switching.

    No position: pick highest calibrated_avg_net.
    Active position: switch only if (gap - switch_cost) > ₹30 AND hold > 15 min.
    """
    if not ENABLE_ENGINE14_OPPORTUNITY_COST or not signals:
        return OpportunityCostResult(
            priority_1_symbol=signals[0].symbol if signals else None,
            priority_1_net=signals[0].net_after_charges if signals else 0,
            priority_2_symbol=signals[1].symbol if len(signals) > 1 else None,
            priority_2_net=signals[1].net_after_charges if len(signals) > 1 else 0,
            switch_recommended=False, switch_reason=None, switch_cost=0,
        )

    p1 = signals[0] if signals else None
    p2 = signals[1] if len(signals) > 1 else None

    # No active position — just rank
    if active_trade is None:
        return OpportunityCostResult(
            priority_1_symbol=p1.symbol if p1 else None,
            priority_1_net=p1.net_after_charges if p1 else 0,
            priority_2_symbol=p2.symbol if p2 else None,
            priority_2_net=p2.net_after_charges if p2 else 0,
            switch_recommended=False, switch_reason=None, switch_cost=0,
        )

    # Active position — evaluate switch
    current_ticker = active_trade["ticker"]
    current_ltp = active_trade["current_ltp"]
    entry_price = active_trade["entry_price"]
    qty = active_trade["qty"]
    hold_min = active_trade.get("hold_min", 0)

    # Can't switch if held < 15 min
    if hold_min < 15:
        return OpportunityCostResult(
            priority_1_symbol=current_ticker,
            priority_1_net=0,
            priority_2_symbol=p1.symbol if p1 else None,
            priority_2_net=p1.net_after_charges if p1 else 0,
            switch_recommended=False,
            switch_reason="Hold time < 15 min — too early to switch",
            switch_cost=0,
        )

    # Compute switch cost (exit current + enter best alternative)
    exit_charges, _ = calculate_angel_charges(qty, entry_price, current_ltp)
    best_alt = p1
    if best_alt and best_alt.symbol != current_ticker:
        entry_charges, _ = calculate_angel_charges(best_alt.qty, best_alt.ltp, best_alt.ltp)
        switch_cost = exit_charges + entry_charges

        # Current position net
        current_gross = qty * (current_ltp - entry_price)
        current_net = current_gross - exit_charges

        # Opportunity gap
        gap = best_alt.net_after_charges - current_net

        if (gap - switch_cost) > 30:
            return OpportunityCostResult(
                priority_1_symbol=best_alt.symbol,
                priority_1_net=best_alt.net_after_charges,
                priority_2_symbol=current_ticker,
                priority_2_net=current_net,
                switch_recommended=True,
                switch_reason=(
                    f"Consider switching: exit {current_ticker}, buy {best_alt.symbol}. "
                    f"Gap ₹{gap:.2f} minus switch cost ₹{switch_cost:.2f} = ₹{gap-switch_cost:.2f} net gain."
                ),
                switch_cost=round(switch_cost, 2),
            )

    return OpportunityCostResult(
        priority_1_symbol=current_ticker,
        priority_1_net=0,
        priority_2_symbol=p1.symbol if p1 and p1.symbol != current_ticker else (p2.symbol if p2 else None),
        priority_2_net=p1.net_after_charges if p1 and p1.symbol != current_ticker else 0,
        switch_recommended=False,
        switch_reason=None,
        switch_cost=0,
    )
