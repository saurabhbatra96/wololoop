"""Reference solution - 01 Trade Settlement Netting.

Notes on the choices an interviewer would probe:

  * Dedupe by trade_id up front, once, instead of sprinkling seen-checks
    through every function. Do it in one helper and every part inherits it.
  * Money stays in integer cents end to end. The only place a non-integer
    exists is inside the FX conversion, and it is a Decimal, never a float.
    `0.1 + 0.2` problems in a settlement system are career-limiting.
  * The greedy in settlement_transfers is the classic debt-simplification
    match-largest-with-largest. It does NOT always produce the theoretical
    minimum number of transfers (that problem is NP-hard - it contains
    subset-sum), but it always terminates in at most n-1 transfers and it is
    what real netting systems ship. Say that out loud in an interview.
"""

import datetime
from decimal import Decimal, ROUND_HALF_UP


# ---------------------------------------------------------------- part 1

def dedupe(trades):
    """Drop repeated trade_ids, keeping the first occurrence, preserving order."""
    seen = set()
    out = []
    for trade in trades:
        if trade["trade_id"] in seen:
            continue
        seen.add(trade["trade_id"])
        out.append(trade)
    return out


def net_positions(trades):
    """{(member, symbol): net_quantity} with flat pairs dropped."""
    positions = {}
    for trade in dedupe(trades):
        key_buy = (trade["buyer"], trade["symbol"])
        key_sell = (trade["seller"], trade["symbol"])
        positions[key_buy] = positions.get(key_buy, 0) + trade["quantity"]
        positions[key_sell] = positions.get(key_sell, 0) - trade["quantity"]
    return {key: qty for key, qty in positions.items() if qty != 0}


# ---------------------------------------------------------------- part 2

def net_cash(trades):
    """{member: net_cents}; positive means the member is owed money."""
    cash = {}
    for trade in dedupe(trades):
        amount = trade["quantity"] * trade["price_cents"]
        cash[trade["buyer"]] = cash.get(trade["buyer"], 0) - amount
        cash[trade["seller"]] = cash.get(trade["seller"], 0) + amount
    return {member: amount for member, amount in cash.items() if amount != 0}


def settlement_transfers(net):
    """Greedy: settle the largest debt against the largest credit.

    Ties break on member name so the output is deterministic.
    """
    if sum(net.values()) != 0:
        raise ValueError("net cash does not sum to zero: %d" % sum(net.values()))

    debtors = sorted(((-amt, m) for m, amt in net.items() if amt < 0), key=lambda p: (-p[0], p[1]))
    creditors = sorted(((amt, m) for m, amt in net.items() if amt > 0), key=lambda p: (-p[0], p[1]))

    transfers = []
    i = j = 0
    owed = list(debtors)
    due = list(creditors)
    while i < len(owed) and j < len(due):
        debt, payer = owed[i]
        credit, payee = due[j]
        amount = min(debt, credit)
        transfers.append((payer, payee, amount))
        debt -= amount
        credit -= amount
        if debt == 0:
            i += 1
        else:
            owed[i] = (debt, payer)
        if credit == 0:
            j += 1
        else:
            due[j] = (credit, payee)
    return transfers


# ---------------------------------------------------------------- part 3

def add_business_days(date_str, days, holidays=()):
    """Advance a YYYY-MM-DD date by `days` settlement days."""
    closed = set(holidays)
    current = datetime.date.fromisoformat(date_str)
    remaining = days
    while remaining > 0:
        current += datetime.timedelta(days=1)
        if current.weekday() >= 5 or current.isoformat() in closed:
            continue
        remaining -= 1
    return current.isoformat()


def to_usd_cents(cents, currency, fx_rates):
    """Convert integer cents in `currency` to integer USD cents, half up."""
    rate = Decimal(str(fx_rates[currency]))
    converted = Decimal(cents) * rate
    return int(converted.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def settlement_plan(trades, fx_rates, holidays=()):
    """{settlement_date: [transfers]} - net inside each settlement date."""
    buckets = {}
    for trade in dedupe(trades):
        settles = add_business_days(trade["trade_date"], 2, holidays)
        buckets.setdefault(settles, []).append(trade)

    plan = {}
    for settles in sorted(buckets):
        cash = {}
        for trade in buckets[settles]:
            amount = to_usd_cents(
                trade["quantity"] * trade["price_cents"], trade["currency"], fx_rates
            )
            cash[trade["buyer"]] = cash.get(trade["buyer"], 0) - amount
            cash[trade["seller"]] = cash.get(trade["seller"], 0) + amount
        cash = {m: a for m, a in cash.items() if a != 0}
        transfers = settlement_transfers(cash)
        if transfers:
            plan[settles] = transfers
    return plan
