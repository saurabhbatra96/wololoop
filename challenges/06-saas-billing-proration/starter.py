# 06 - SaaS Billing and Proration
#
# Every amount is an integer number of cents. Floats never touch money.

PLAN = {"name": "pro", "base_cents": 9900, "per_seat_cents": 1500, "included_seats": 5}


def invoice(plan, seats, period_start, period_end):
    """Whole-period invoice: {"lines": [...], "total_cents": int}."""
    raise NotImplementedError("invoice")


if __name__ == "__main__":
    print(invoice(PLAN, 8, "2026-03-01", "2026-04-01"))
