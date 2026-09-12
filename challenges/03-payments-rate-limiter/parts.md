## Part 1 — Fixed window

Our payments API keeps falling over when one integrator's retry loop goes
feral. You're adding rate limiting at the edge.

Start with the simplest thing that works:

```python
class FixedWindowLimiter:
    def __init__(self, limit, window_seconds): ...
    def allow(self, api_key, now) -> bool
```

`allow` returns `True` and counts the request, or `False` and rejects it.
Each API key gets `limit` requests per fixed `window_seconds` block of wall
clock time — 0–60s is one window, 60–120s is the next, and the count resets at
each boundary.

```python
limiter = FixedWindowLimiter(limit=3, window_seconds=60)
[limiter.allow("acct_7", t) for t in (0, 1, 2, 3, 61)]
# [True, True, True, False, True]
```

Note that `now` is **passed in**. Never reach for `time.time()` inside a
limiter: it makes the thing impossible to test without `sleep`, and a test
suite that sleeps is a test suite nobody runs. If an interviewer doesn't offer
you the parameter, ask for it — noticing this is part of what's being marked.

<!-- part -->

## Part 2 — Sliding window

An integrator just sent 3 requests at 00:00:59 and 3 more at 00:01:01, and our
"3 per minute" limiter let all six through. Six requests in two seconds. That's
the fixed window's seam, and it's worth understanding before you fix it: the
counter resets on a clock boundary, so a client can spend a full window's budget
on each side of it.

```python
class SlidingWindowLimiter:
    def __init__(self, limit, window_seconds): ...
    def allow(self, api_key, now) -> bool
    def retry_after(self, api_key, now) -> float
```

Now the window is the **trailing** `window_seconds` from `now`. A request is
permitted if fewer than `limit` permitted requests landed in that trailing
window. A call that happened exactly `window_seconds` ago has expired.

Two details that matter:

- **A rejected request is not recorded.** If being throttled extended your own
  throttle, a client in a retry loop would lock itself out permanently. This is
  a real outage people have caused.
- `retry_after` returns seconds until the next call would be allowed, `0.0` if
  one is allowed right now, and **never consumes budget** — it's what you put in
  the `Retry-After` header.

```python
limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
[limiter.allow("k", t) for t in (59, 59, 60, 61)]   # [True, True, False, False]
```

> Be ready for "what does this cost you?". You're now holding a timestamp per
> permitted request per key. At 10k requests/minute per key that's real memory,
> which is exactly why the next step exists.

<!-- part -->

## Part 3 — Token bucket and tiers

Product wants paid customers to burst harder than free ones, and infra wants the
memory back. Token bucket does both: **O(1) state per key**, a float and a
timestamp, regardless of traffic.

```python
TIERS = {
    "free": {"burst": 5,  "refill_per_second": 1.0},
    "pro":  {"burst": 20, "refill_per_second": 10.0},
}

class TokenBucketLimiter:
    def __init__(self, tiers): ...
    def allow(self, api_key, tier, now) -> bool
    def retry_after(self, api_key, tier, now) -> float
```

How it works: a key's bucket holds up to `burst` tokens and starts **full**.
Tokens accrue continuously at `refill_per_second` and are capped at `burst` —
idling overnight does not buy you a bigger burst. A request costs one token; if
fewer than one is available, reject.

Tokens are fractional. Half a second of free-tier refill is half a token, which
is not enough to let a request through, but it is not lost either.

`retry_after` returns how long until one whole token exists — and again, asking
must not spend one.

```python
limiter = TokenBucketLimiter(TIERS)
[limiter.allow("k", "free", 0) for _ in range(6)]   # 5 x True, then False
limiter.retry_after("k", "free", 0.25)              # 0.75
```

> Worth saying out loud: this is one process's memory. The moment there are two
> API servers the customer gets 2x the limit. The usual answers are a shared
> store with atomic ops (Redis `INCR`/Lua), or accepting the drift and giving
> each node `limit / n`. Knowing which one you'd pick, and why, is the senior
> half of this question.
