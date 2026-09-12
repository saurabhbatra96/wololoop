## Part 1 — Net positions

You've joined the post-trade team at a small clearing house. Members trade with
each other all day; at 5pm we have to work out who actually owes what to whom.

Everything starts from the **blotter**: a flat list of executed trades.

```python
{
    "trade_id":   "T1",           # unique, but the feed sometimes repeats one
    "buyer":      "ALPHA",        # member code
    "seller":     "BRAVO",
    "symbol":     "ACME",
    "quantity":   100,            # always positive
    "price_cents": 1050,          # integer cents per share
    "currency":   "USD",
    "trade_date": "2026-03-02",
}
```

Write:

```python
net_positions(trades) -> dict
```

returning `{(member, symbol): net_quantity}` — positive if the member ends up
long, negative if short. Rules:

- The buyer gains `quantity`, the seller loses it. Every trade touches two members.
- Drop any pair that nets to **zero**. Ops doesn't want to read rows that say nothing.
- **The upstream feed occasionally sends the same trade twice.** `trade_id` is
  unique, so a repeat is a duplicate, not a second trade. Book it once.
- Don't modify the list you were given.

With the five trades in `SAMPLE_TRADES`:

```python
{('ALPHA', 'ACME'): 200, ('ALPHA', 'ZINC'): -50,
 ('BRAVO', 'ACME'): -160, ('BRAVO', 'ZINC'): 25,
 ('CIRRUS', 'ACME'): -40, ('CIRRUS', 'ZINC'): 25}
```

<!-- part -->

## Part 2 — Cash netting

Good. Now the money side, which is where it gets interesting.

Every trade has a cash leg: the buyer owes `quantity * price_cents`, the seller
is owed the same. First, collapse that to one number per member:

```python
net_cash(trades) -> dict     # {member: net_cents}, positive = owed money
```

Same rules as before — drop members who net to zero, ignore duplicate ids.
For the sample blotter: `{'ALPHA': -107500, 'BRAVO': 113500, 'CIRRUS': -6000}`.

Here's the real ask. Right now ALPHA owes the clearing house, CIRRUS owes the
clearing house, and the clearing house owes BRAVO — three wire transfers, three
sets of fees. We'd rather move the money **directly between members**, in as few
payments as possible:

```python
settlement_transfers(net) -> list     # [(payer, payee, cents), ...]
```

Take the net-cash dict and return payments that leave everyone square. Rules:

- Use the **largest outstanding debt against the largest outstanding credit**,
  repeatedly. Break ties on member name, A→Z, so the output is deterministic —
  the tests compare the exact list.
- Never a self-payment, never a zero or negative amount.
- With `n` members involved you should never emit more than `n-1` payments.

The sample blotter should settle in two payments:

```python
[('ALPHA', 'BRAVO', 107500), ('CIRRUS', 'BRAVO', 6000)]
```

> One thing worth being able to say out loud: this greedy does **not** always
> find the theoretical minimum number of transfers. That problem is NP-hard — it
> has subset-sum hiding inside it. The greedy is what real netting systems ship
> because it's O(n log n) and always lands within n-1. Knowing the difference is
> the point.

<!-- part -->

## Part 3 — FX and settlement dates

Two complications from the business, both non-negotiable.

**We're multi-currency now.** Trades settle in USD, but `price_cents` is in the
trade's own currency. You're handed a rate table — USD per one unit of currency,
as decimal **strings**, because nobody sends you a float for money:

```python
{"USD": "1", "EUR": "1.0850", "GBP": "1.2740", "CHF": "1.2500"}
```

Convert each trade's cash leg to whole USD cents, rounding **half up**. Note
that Python's built-in `round()` does *not* do this — it rounds half to even, so
62.5 becomes 62. Ops will notice.

**Money moves on settlement date, not trade date.** A trade settles **T+2
settlement days**: skip weekends, and skip any date in the `holidays` set. A
Monday trade normally settles Wednesday; if Wednesday is a holiday, Thursday.

Netting happens *within* a settlement date — you can't net cash that moves on
different days.

```python
settlement_plan(trades, fx_rates, holidays=()) -> dict
```

Return `{settlement_date: [(payer, payee, usd_cents), ...]}`. Omit any date that
nets flat. Reuse what you built in part 2 rather than rewriting the greedy.

Four trades, with 2026-03-04 closed:

```python
{'2026-03-05': [('CIRRUS', 'BRAVO', 54250), ('ALPHA', 'BRAVO', 50750)],
 '2026-03-09': [('BRAVO', 'CIRRUS', 56056)],
 '2026-03-10': [('ALPHA', 'BRAVO', 1084)]}
```
