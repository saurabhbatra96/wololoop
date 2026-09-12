"""Reference solution - 06 SaaS Billing and Proration.

Rules that keep billing code honest:

  * Every amount is an integer number of cents. Decimal appears only inside a
    single proration calculation and is quantized straight back to an int.
    Floats never touch money.
  * Round once, at the smallest unit the customer can see - here, per line.
    Rounding a running total repeatedly is how invoices end up a cent off.
  * The event log is the source of truth. Replaying it must be idempotent and
    order-independent, because the webhook that delivered it guarantees neither.
"""

import datetime
from decimal import Decimal, ROUND_HALF_UP


def _days(start, end):
    return (datetime.date.fromisoformat(end) - datetime.date.fromisoformat(start)).days


def _half_up(value):
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _billable_seats(plan, seats):
    return max(0, seats - plan["included_seats"])


# ---------------------------------------------------------------- part 1

def invoice(plan, seats, period_start, period_end):
    """A whole-period invoice: base fee plus whatever seats aren't included."""
    lines = [{"kind": "base", "seats": None,
              "days": _days(period_start, period_end), "cents": plan["base_cents"]}]

    billable = _billable_seats(plan, seats)
    if billable:
        lines.append({"kind": "seats", "seats": seats,
                      "days": _days(period_start, period_end),
                      "cents": billable * plan["per_seat_cents"]})

    return {"lines": lines, "total_cents": sum(line["cents"] for line in lines)}


# ---------------------------------------------------------------- part 2

def _segments(changes, period_start, active_end):
    """Flatten seat changes into non-overlapping [start, end) runs."""
    ordered = sorted(changes, key=lambda change: change["date"])
    segments = []
    for index, change in enumerate(ordered):
        start = max(change["date"], period_start)
        end = ordered[index + 1]["date"] if index + 1 < len(ordered) else active_end
        end = min(end, active_end)
        if end > start:                       # same-day changes: the last one wins
            segments.append((start, end, change["seats"]))
    return segments


def prorate(plan, changes, period_start, period_end, active_end=None):
    """Charge the base fee in full, and seats for the days they existed."""
    active_end = active_end or period_end
    period_days = _days(period_start, period_end)

    lines = [{"kind": "base", "seats": None, "days": period_days,
              "cents": plan["base_cents"]}]

    for start, end, seats in _segments(changes, period_start, active_end):
        billable = _billable_seats(plan, seats)
        if not billable:
            continue
        days = _days(start, end)
        cents = _half_up(
            Decimal(plan["per_seat_cents"]) * billable * Decimal(days) / Decimal(period_days)
        )
        lines.append({"kind": "seats", "seats": seats, "days": days, "cents": cents})

    return {"lines": lines, "total_cents": sum(line["cents"] for line in lines)}


# ---------------------------------------------------------------- part 3

def replay(plan, events, period_start, period_end):
    """Rebuild the invoice from the event log, whatever order it arrives in."""
    seen = set()
    ordered = []
    for event in sorted(events, key=lambda e: (e["at"], e["event_id"])):
        if event["event_id"] in seen:         # at-least-once delivery
            continue
        seen.add(event["event_id"])
        ordered.append(event)

    changes = []
    cancelled_at = None
    for event in ordered:
        if cancelled_at is not None:          # nothing counts after a cancel
            break
        if event["type"] in ("subscribe", "change_seats"):
            changes.append({"date": max(event["at"], period_start), "seats": event["seats"]})
        elif event["type"] == "cancel":
            cancelled_at = max(event["at"], period_start)

    if not changes:
        return {"lines": [], "total_cents": 0}

    active_end = min(cancelled_at, period_end) if cancelled_at else period_end
    result = prorate(plan, changes, period_start, period_end, active_end)

    if cancelled_at and active_end < period_end:
        period_days = _days(period_start, period_end)
        active_days = _days(period_start, active_end)
        kept = _half_up(Decimal(plan["base_cents"]) * Decimal(active_days) / Decimal(period_days))
        result["lines"].append({"kind": "credit", "seats": None,
                                "days": period_days - active_days,
                                "cents": kept - plan["base_cents"]})
        result["total_cents"] = sum(line["cents"] for line in result["lines"])

    return result
