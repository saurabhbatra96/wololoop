## Part 1 — FEFO allocation

You're on the fulfilment team at a grocery retailer. Stock arrives in **lots**,
each with its own expiry date, and orders have to be filled from real lots — not
from an abstract "we have 400 of these somewhere".

```python
{"lot_id": "L1", "sku": "TEA", "warehouse": "W1", "quantity": 40,
 "received_at": "2026-05-01", "expires_at": "2026-07-01"}

{"order_id": "O1", "sku": "TEA", "quantity": 50, "region": "north"}
```

Write:

```python
allocate(lots, orders, today) -> dict
```

```python
{"allocations": {"O1": [("L2", 30), ("L1", 20)]},
 "shortfalls":  {"O2": 15}}
```

Rules:

- **FEFO — first expired, first out.** Ship the stock that dies soonest, not the
  stock that arrived first. Perishables are the whole reason this job exists.
  Ties break on `received_at`, then `lot_id`, so the answer is never ambiguous.
- A lot whose `expires_at` is **on or before** `today` cannot ship at all.
- Orders are filled in the order given, and each one consumes stock the next
  one then can't have.
- One order can span several lots. Take what a lot has, move to the next.
- Every order gets an entry in `allocations`, even if it's an empty list. Only
  orders that couldn't be filled completely appear in `shortfalls`, with the
  quantity still missing.

<!-- part -->

## Part 2 — Multi-warehouse

We've opened two more warehouses, and shipping now costs real money.

```python
allocate_multi(lots, orders, distances, today) -> dict
```

`distances` maps `(warehouse, region)` to kilometres. Allocations now name the
warehouse: `("W1", "L2", 30)`.

The rule the logistics team actually wants, in priority order:

1. **One parcel beats a short parcel.** If any single warehouse can fill the
   whole order on its own, use it — even if a closer warehouse could have
   covered part of it. A split shipment costs more than the extra distance.
2. Among warehouses that can fill it alone, take the **nearest**. Ties break on
   warehouse name.
3. If **no** single warehouse can cover it, split — taking as much as possible
   from the nearest, then the next, and so on.
4. A warehouse with no entry in `distances` for that region can't ship there at
   all. It doesn't matter how much stock it's holding.
5. FEFO still applies **within** each warehouse.

> Note what rule 1 costs you: an order for 40 units will take the far warehouse
> that has 100 rather than the near one that has 39, and a human looking at the
> shipping bill will ask why. That's a business rule, not a bug, and being able
> to state the trade-off cleanly is the point. Optimal split-minimisation across
> all orders at once is bin-packing — genuinely hard, and not what ships.

<!-- part -->

## Part 3 — Reservations with TTL

Checkout is the bit that oversells. Someone puts 30 units in a basket, we count
them as available for the next six minutes, and two customers pay for the same
tin of tea.

```python
class ReservationLedger:
    def __init__(self, lots, today): ...
    def available(self, sku, now) -> int
    def reserve(self, order_id, sku, quantity, now, ttl_seconds) -> bool
    def confirm(self, order_id, now) -> bool
    def cancel(self, order_id) -> bool
```

`now` and `ttl_seconds` are plain integer seconds — no wall clock inside the
ledger.

- `available` is live stock (unexpired lots) minus everything currently held.
- `reserve` holds stock for `ttl_seconds` and returns `False` rather than
  overselling. A hold whose expiry is **at or before** `now` no longer counts.
- `confirm` makes the hold permanent — the units never come back. Confirming a
  lapsed hold fails: that stock may already be promised to somebody else.
- `cancel` releases a hold. You cannot cancel a confirmed order; that's a
  refund, and it isn't this function's job.
- An order whose hold lapsed may reserve again — the customer came back.
- Unknown order ids return `False` rather than raising.

> There's no sweeper thread here and there shouldn't be. Reservations expire
> **lazily**: nothing is deleted on a timer, we simply decline to count expired
> holds whenever someone asks. That's the usual production shape, and the
> follow-up question is what it costs you — lapsed holds accumulate in memory
> until something prunes them.
