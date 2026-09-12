## Part 1 — Limit orders and fills

You're on the core team at a small equities venue. Everything the business does
sits on top of one object: the **matching engine**.

Orders arrive one at a time, in the order you receive them:

```python
{
    "order_id":    "B",
    "member":      "M2",       # the firm that sent it
    "side":        "buy",      # or "sell"
    "price_cents": 1010,       # limit price
    "quantity":    100,
}
```

Build:

```python
class MatchingEngine:
    def submit(self, order) -> list   # the fills this order caused
```

A fill is a tuple `(taker_order_id, maker_order_id, quantity, price_cents)`.
The **taker** is the order being submitted; a **maker** is an order already
resting on the book.

The rules, which are not negotiable anywhere in the world:

- A buy matches a sell when `ask_price <= bid_price`. Otherwise it rests.
- **Price-time priority.** Best price first; at equal prices, whoever got there
  first. Bids sort high→low, asks low→high.
- **A trade happens at the maker's price, not the taker's.** A buy at 1050
  hitting a resting ask of 1010 trades at 1010 — the taker gets the improvement.
  Getting this backwards is the single most common way to fail this question.
- Quantities partially fill. Whatever the taker cannot trade **rests on the
  book** and becomes a maker itself. A partly-filled maker stays with its
  remainder and keeps its original time priority.
- One submit can produce several fills as it walks down the book.

```python
engine.submit({"order_id": "A", "member": "M1", "side": "sell",
               "price_cents": 1010, "quantity": 100})   # -> []  (rests)
engine.submit({"order_id": "B", "member": "M2", "side": "buy",
               "price_cents": 1050, "quantity": 30})    # -> [("B", "A", 30, 1010)]
```

> Reach for `heapq`. A sorted list re-sorted on every insert will pass these
> tests and get you asked about complexity in a way you won't enjoy.

<!-- part -->

## Part 2 — Cancels and depth

Two things every real venue needs on day one.

**Cancels.**

```python
engine.cancel(order_id) -> bool
```

`True` if there was live resting quantity to pull, `False` otherwise — unknown
id, already fully filled, or already cancelled. A partly-filled order can still
be cancelled: you're pulling the remainder, and the fills that already happened
stand.

**Depth**, for the market-data feed:

```python
engine.book() -> {"bids": [(price, qty), ...], "asks": [(price, qty), ...]}
```

Resting quantity aggregated per price level, **bids high→low, asks low→high**.
Cancelled and fully-filled orders don't appear. Empty sides are `[]`.

```python
engine.book()
{'bids': [(1005, 10), (1000, 10)], 'asks': [(1015, 30)]}
```

> The interesting part is what cancel does to your heap. You cannot pull an
> arbitrary element out of a binary heap cheaply. The standard answer is **lazy
> deletion**: mark the order dead in your index, leave the heap entry where it
> is, and skip dead entries when you look at the top. Be ready to say what that
> costs you — the heap can hold entries for orders that no longer exist, so
> memory grows with cancels, not with resting orders.

<!-- part -->

## Part 3 — Market orders and self-trade prevention

**Market orders** arrive with `price_cents = None`. They take any price the book
offers. The one rule that trips people up: a market order **never rests**. If
the book runs out, whatever is left is discarded, not parked at some invented
price.

**Top of book**, for the same feed as before:

```python
engine.best_bid()   # highest resting bid price, or None
engine.best_ask()   # lowest resting ask price, or None
engine.spread()     # ask - bid, or None if either side is empty
```

These get called on every tick, so they should be cheap — not a rebuild of the
whole depth picture.

**Self-trade prevention.** Regulators take a dim view of a firm trading with
itself: it prints a trade that moves no risk, which is indistinguishable from
painting the tape. If a taker is about to match a resting order from **the same
`member`**, the resting order is **cancelled**, no fill is printed, and the
taker carries on matching against whatever is behind it.

```python
# M1 is resting at 1010; M2 is resting at 1015; M1 sends a buy at 1020.
# -> M1's own ask is pulled, M1 trades with M2, and any remainder rests.
```
