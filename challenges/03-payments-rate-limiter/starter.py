# 03 - Payments API Rate Limiter
#
# `now` is always passed in as a float of seconds. Never call time.time()
# inside the limiter - it makes the thing untestable without sleeping.


class FixedWindowLimiter:
    def __init__(self, limit, window_seconds):
        raise NotImplementedError("FixedWindowLimiter.__init__")

    def allow(self, api_key, now):
        """True if this request is permitted, and count it. False to reject."""
        raise NotImplementedError("allow")


if __name__ == "__main__":
    limiter = FixedWindowLimiter(limit=3, window_seconds=60)
    print([limiter.allow("acct_7", t) for t in (0, 1, 2, 3, 61)])
