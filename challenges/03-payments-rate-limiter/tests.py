# Tests for 03 - Payments API Rate Limiter.

TIERS = {
    "free": {"burst": 5, "refill_per_second": 1.0},
    "pro": {"burst": 20, "refill_per_second": 10.0},
}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_allows_up_to_the_limit():
    """the first `limit` calls in a window go through"""
    limiter = FixedWindowLimiter(limit=3, window_seconds=60)
    assert_eq([limiter.allow("k", t) for t in (0, 1, 2)], [True, True, True])


@stage(1)
def test_rejects_past_the_limit():
    """call number limit+1 is rejected"""
    limiter = FixedWindowLimiter(limit=3, window_seconds=60)
    for t in (0, 1, 2):
        limiter.allow("k", t)
    assert_eq(limiter.allow("k", 3), False)


@stage(1)
def test_window_resets():
    """a new window starts the count again"""
    limiter = FixedWindowLimiter(limit=2, window_seconds=60)
    assert_eq([limiter.allow("k", t) for t in (0, 1, 2, 60, 61, 62)],
              [True, True, False, True, True, False])


@stage(1)
def test_window_boundary_is_exact():
    """t=60 belongs to the second window, not the first"""
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    assert_eq([limiter.allow("k", 59.999), limiter.allow("k", 60.0)], [True, True])


@stage(1)
def test_keys_are_independent():
    """one noisy customer does not throttle another"""
    limiter = FixedWindowLimiter(limit=1, window_seconds=60)
    assert_eq([limiter.allow("a", 0), limiter.allow("b", 0), limiter.allow("a", 1)],
              [True, True, False])


@stage(1)
def test_zero_limit_rejects_everything():
    """a limit of 0 is a closed door, not an off switch"""
    limiter = FixedWindowLimiter(limit=0, window_seconds=60)
    assert_eq(limiter.allow("k", 0), False)


@stage(1)
def test_simultaneous_timestamps():
    """several calls on the same tick still count separately"""
    limiter = FixedWindowLimiter(limit=2, window_seconds=60)
    assert_eq([limiter.allow("k", 5), limiter.allow("k", 5), limiter.allow("k", 5)],
              [True, True, False])


# ------------------------------------------------------------------ part 2

@stage(2)
def test_sliding_allows_up_to_the_limit():
    """same headline behaviour as before"""
    limiter = SlidingWindowLimiter(limit=3, window_seconds=60)
    assert_eq([limiter.allow("k", t) for t in (0, 10, 20, 30)],
              [True, True, True, False])


@stage(2)
def test_sliding_has_no_seam():
    """the burst the fixed window allowed at the boundary is now refused"""
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    assert_eq([limiter.allow("k", t) for t in (59, 59, 60, 61)],
              [True, True, False, False],
              "two calls at t=59 fill the window until t=119")


@stage(2)
def test_oldest_call_falls_out():
    """once the first call ages out, there is room again"""
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    for t in (0, 30):
        limiter.allow("k", t)
    assert_eq([limiter.allow("k", 59), limiter.allow("k", 60), limiter.allow("k", 90)],
              [False, True, True])


@stage(2)
def test_rejected_calls_are_not_recorded():
    """being throttled must not extend your own throttle"""
    limiter = SlidingWindowLimiter(limit=1, window_seconds=10)
    limiter.allow("k", 0)
    for t in (1, 2, 3, 4, 5, 6, 7, 8, 9):
        limiter.allow("k", t)
    assert_eq(limiter.allow("k", 10.001), True,
              "the hammering between t=1 and t=9 should not have pushed the window out")


@stage(2)
def test_retry_after_is_zero_when_allowed():
    """nothing to wait for"""
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    limiter.allow("k", 0)
    assert_close(limiter.retry_after("k", 10), 0.0)


@stage(2)
def test_retry_after_counts_down_to_the_oldest_call():
    """you wait until the oldest call leaves the window"""
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    limiter.allow("k", 0)
    limiter.allow("k", 10)
    assert_close(limiter.retry_after("k", 30), 30.0)


@stage(2)
def test_retry_after_does_not_consume():
    """asking is free"""
    limiter = SlidingWindowLimiter(limit=2, window_seconds=60)
    limiter.allow("k", 0)
    limiter.retry_after("k", 1)
    limiter.retry_after("k", 1)
    assert_eq(limiter.allow("k", 1), True)


@stage(2)
def test_sliding_keys_are_independent():
    """still per customer"""
    limiter = SlidingWindowLimiter(limit=1, window_seconds=60)
    assert_eq([limiter.allow("a", 0), limiter.allow("b", 0), limiter.allow("a", 1)],
              [True, True, False])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_bucket_starts_full():
    """a new key can burst immediately"""
    limiter = TokenBucketLimiter(TIERS)
    assert_eq([limiter.allow("k", "free", 0) for _ in range(5)], [True] * 5)


@stage(3)
def test_bucket_empties():
    """the sixth call on a burst of 5 is refused"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(5):
        limiter.allow("k", "free", 0)
    assert_eq(limiter.allow("k", "free", 0), False)


@stage(3)
def test_bucket_refills_steadily():
    """one token per second on the free tier"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(5):
        limiter.allow("k", "free", 0)
    assert_eq([limiter.allow("k", "free", 1.0), limiter.allow("k", "free", 1.0)],
              [True, False])


@stage(3)
def test_refill_is_capped_at_burst():
    """idling all day does not buy you a bigger burst"""
    limiter = TokenBucketLimiter(TIERS)
    limiter.allow("k", "free", 0)
    assert_eq([limiter.allow("k", "free", 86400) for _ in range(6)],
              [True] * 5 + [False])


@stage(3)
def test_partial_tokens_accumulate():
    """half a second is half a token, and half a token is not enough"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(5):
        limiter.allow("k", "free", 0)
    assert_eq([limiter.allow("k", "free", 0.5), limiter.allow("k", "free", 1.0)],
              [False, True])


@stage(3)
def test_tiers_have_different_budgets():
    """pro bursts to 20"""
    limiter = TokenBucketLimiter(TIERS)
    assert_eq([limiter.allow("p", "pro", 0) for _ in range(21)], [True] * 20 + [False])


@stage(3)
def test_retry_after_on_an_empty_bucket():
    """a full second to earn the next free-tier token"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(5):
        limiter.allow("k", "free", 0)
    assert_close(limiter.retry_after("k", "free", 0), 1.0)
    assert_close(limiter.retry_after("k", "free", 0.25), 0.75)


@stage(3)
def test_retry_after_uses_the_tier_rate():
    """pro refills ten times faster, so it waits a tenth as long"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(20):
        limiter.allow("p", "pro", 0)
    assert_close(limiter.retry_after("p", "pro", 0), 0.1)


@stage(3)
def test_retry_after_zero_when_tokens_remain():
    """no wait while you still have budget"""
    limiter = TokenBucketLimiter(TIERS)
    limiter.allow("k", "free", 0)
    assert_close(limiter.retry_after("k", "free", 0), 0.0)


@stage(3)
def test_retry_after_does_not_spend_a_token():
    """checking the header must not cost the caller a request"""
    limiter = TokenBucketLimiter(TIERS)
    for _ in range(4):
        limiter.allow("k", "free", 0)
    for _ in range(10):
        limiter.retry_after("k", "free", 0)
    assert_eq(limiter.allow("k", "free", 0), True, "the fifth token should still be there")
