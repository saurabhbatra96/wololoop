"""Reference solution - 03 Payments API Rate Limiter.

Time is always injected. A limiter that calls time.time() internally cannot be
tested without sleeping, and a test suite that sleeps is a test suite nobody
runs. If an interviewer doesn't hand you the `now` parameter, ask for it.
"""

import collections


# ---------------------------------------------------------------- part 1

class FixedWindowLimiter:
    """Count per key per fixed clock window. Cheap, and bursty at the seams."""

    def __init__(self, limit, window_seconds):
        self.limit = limit
        self.window = window_seconds
        self._counts = {}          # (key, window_index) -> count

    def allow(self, api_key, now):
        bucket = int(now // self.window)
        key = (api_key, bucket)
        used = self._counts.get(key, 0)
        if used >= self.limit:
            return False
        self._counts[key] = used + 1
        return True


# ---------------------------------------------------------------- part 2

class SlidingWindowLimiter:
    """Keep the actual timestamps, so the window really does slide."""

    def __init__(self, limit, window_seconds):
        self.limit = limit
        self.window = window_seconds
        self._hits = collections.defaultdict(collections.deque)

    def _evict(self, api_key, now):
        hits = self._hits[api_key]
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()
        return hits

    def allow(self, api_key, now):
        hits = self._evict(api_key, now)
        if len(hits) >= self.limit:
            return False           # a rejected call is not recorded
        hits.append(now)
        return True

    def retry_after(self, api_key, now):
        hits = self._evict(api_key, now)
        if len(hits) < self.limit:
            return 0.0
        # the oldest hit has to fall out of the window before there is room
        return hits[0] + self.window - now


# ---------------------------------------------------------------- part 3

class TokenBucketLimiter:
    """Burst up to `burst`, then settle to `refill_per_second`.

    Tokens are tracked as a float plus the timestamp they were last refilled -
    no background timer, no per-request bookkeeping proportional to traffic.
    """

    def __init__(self, tiers):
        self.tiers = tiers
        self._state = {}           # api_key -> [tokens, last_seen]

    def _tokens_at(self, api_key, tier, now):
        config = self.tiers[tier]
        tokens, last = self._state.get(api_key, (float(config["burst"]), now))
        tokens = min(config["burst"], tokens + (now - last) * config["refill_per_second"])
        return tokens, config

    def allow(self, api_key, tier, now):
        tokens, config = self._tokens_at(api_key, tier, now)
        if tokens >= 1:
            self._state[api_key] = (tokens - 1, now)
            return True
        self._state[api_key] = (tokens, now)
        return False

    def retry_after(self, api_key, tier, now):
        """Seconds until one token is available. Never consumes one."""
        tokens, config = self._tokens_at(api_key, tier, now)
        if tokens >= 1:
            return 0.0
        return (1 - tokens) / config["refill_per_second"]
