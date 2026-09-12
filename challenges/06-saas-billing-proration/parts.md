## Part 1 — Whole-period invoice

You're on billing at a B2B SaaS company. Billing bugs are the ones customers
notice, screenshot, and tweet, so this code gets read carefully.

A plan:

```python
PLAN = {"name": "pro", "base_cents": 9900,
        "per_seat_cents": 1500, "included_seats": 5}
```

Write:

```python
invoice(plan, seats, period_start, period_end) -> dict
```

returning

```python
{"lines": [{"kind": "base",  "seats": None, "days": 31, "cents": 9900},
           {"kind": "seats", "seats": 8,    "days": 31, "cents": 4500}],
 "total_cents": 14400}
```

- The base fee is always charged.
- Only seats **beyond** `included_seats` cost anything — 8 seats on this plan is
  3 chargeable seats.
- If there's nothing to charge for seats, don't emit the line at all. A zero
  line item on an invoice generates a support ticket.
- `total_cents` is the sum of the lines. Periods are half-open: `"2026-03-01"`
  to `"2026-04-01"` is 31 days.

**Everything is an integer number of cents.** No floats, anywhere, for any
reason. If you find yourself typing `0.15` in a billing system, stop.

<!-- part -->

## Part 2 — Mid-cycle proration

Customers add and remove seats whenever they like, and they expect to pay for
what they had, when they had it.

```python
prorate(plan, changes, period_start, period_end) -> dict
```

`changes` is a list of `{"date": "2026-03-16", "seats": 13}`. Each one sets the
seat count from that date until the next change or the end of the period.

- Split the period into segments and bill each one for its own days.
- A segment's charge is `per_seat_cents * chargeable_seats * days / period_days`,
  rounded **half up** to the cent. Use `Decimal`, and **round once per line** —
  rounding a running total repeatedly is how invoices end up a cent off, every
  month, forever.
- The base fee is **not** prorated. It's a whole-period charge.
- Changes dated before `period_start` apply from the start of the period.
- Two changes on the same date: the last one wins, and a zero-length segment
  produces no line.
- The list arrives unsorted.

8 seats until 16 March, then 13:

```python
{"lines": [{"kind": "base",  "seats": None, "days": 31, "cents": 9900},
           {"kind": "seats", "seats": 8,    "days": 15, "cents": 2177},
           {"kind": "seats", "seats": 13,   "days": 16, "cents": 6194}],
 "total_cents": 18271}
```

<!-- part -->

## Part 3 — Replaying the event log

Seat changes don't arrive as a tidy list. They arrive as webhooks, out of order,
sometimes twice, occasionally a week late.

```python
replay(plan, events, period_start, period_end) -> dict
```

```python
{"event_id": "e1", "type": "subscribe",    "at": "2026-03-01", "seats": 8}
{"event_id": "e2", "type": "change_seats", "at": "2026-03-16", "seats": 13}
{"event_id": "e3", "type": "cancel",       "at": "2026-03-21"}
```

Rebuild the invoice from the log:

- **Order by `at`, then `event_id`.** Delivery order means nothing.
- **Deduplicate on `event_id`.** The queue is at-least-once, so the same event
  will arrive twice and must not be billed twice. Replaying the same log must
  give a byte-identical invoice.
- A **`cancel`** ends the subscription. Seats stop being charged that day, and
  everything after the cancel is ignored — including a seat change that somehow
  arrives later.
- The base fee was charged for the whole period, so a cancel emits a
  **`"credit"`** line: the unused portion of the base fee, prorated by day,
  as a **negative** number of cents. It counts toward `total_cents`.
- A cancel dated after the period ends earns no credit — they had the month.
- No subscription in the period at all: `{"lines": [], "total_cents": 0}`.

Cancelled on 21 March — 20 days kept, 11 credited:

```python
{"lines": [{"kind": "base",   "seats": None, "days": 31, "cents": 9900},
           {"kind": "seats",  "seats": 8,    "days": 15, "cents": 2177},
           {"kind": "seats",  "seats": 13,   "days": 5,  "cents": 1935},
           {"kind": "credit", "seats": None, "days": 11, "cents": -3513}],
 "total_cents": 10499}
```

> The property worth naming here is **idempotency**. Replaying a log has to be
> safe, because it's the only way to fix a billing bug: correct the code, replay
> the month, reissue. A pipeline that double-bills on replay can never be
> repaired, only apologised for.
