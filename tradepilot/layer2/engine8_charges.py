"""Engine 8: Charge Calculator — pure function, no broker call.

This is the ONLY place broker-specific numbers live.
Models Angel One's slab structure. If your broker changes slabs, edit here only.
"""

from dataclasses import dataclass


@dataclass
class ChargeBreakdown:
    brokerage: float
    stt: float
    exchange_txn: float
    sebi: float
    stamp_duty: float
    gst: float
    total: float


def calculate_angel_charges(qty: int, buy_price: float, sell_price: float) -> tuple[float, ChargeBreakdown]:
    """
    Calculate estimated trading charges for an intraday equity trade.

    Models Angel One's charge structure:
    - Brokerage: 0.1% or ₹20 max per side, ₹5 min per side
    - STT: 0.025% on sell side
    - Exchange txn: 0.00307% on turnover
    - SEBI: 0.0001% on turnover
    - Stamp duty: 0.003% on buy side
    - GST: 18% on (brokerage + exchange txn)

    Returns (total_charges, breakdown).
    """
    buy_val = qty * buy_price
    sell_val = qty * sell_price
    turnover = buy_val + sell_val

    # Brokerage: 0.1% capped at ₹20, floor ₹5 per side
    broker_buy = max(min(buy_val * 0.001, 20.0), 5.0)
    broker_sell = max(min(sell_val * 0.001, 20.0), 5.0)
    total_brokerage = broker_buy + broker_sell

    # STT: 0.025% on sell value (intraday equity)
    stt = sell_val * 0.00025

    # Exchange transaction charges: 0.00307% on turnover
    exchange_txn = turnover * 0.0000307

    # SEBI charges: 0.0001% on turnover
    sebi = turnover * 0.000001

    # Stamp duty: 0.003% on buy value
    stamp_duty = buy_val * 0.00003

    # GST: 18% on (brokerage + exchange txn charges)
    gst = (total_brokerage + exchange_txn) * 0.18

    total = total_brokerage + stt + exchange_txn + sebi + stamp_duty + gst

    breakdown = ChargeBreakdown(
        brokerage=round(total_brokerage, 2),
        stt=round(stt, 2),
        exchange_txn=round(exchange_txn, 2),
        sebi=round(sebi, 2),
        stamp_duty=round(stamp_duty, 2),
        gst=round(gst, 2),
        total=round(total, 2),
    )
    return round(total, 2), breakdown
