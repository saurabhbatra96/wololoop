# Tests for 02 - Order Matching Engine.

def _order(oid, side, price, qty, member="M1"):
    return {"order_id": oid, "member": member, "side": side,
            "price_cents": price, "quantity": qty}


def _engine(*orders):
    """Build an engine and submit a series of orders, returning (engine, fills)."""
    engine = MatchingEngine()
    fills = []
    for order in orders:
        fills.extend(engine.submit(order))
    return engine, fills


# ------------------------------------------------------------------ part 1

@stage(1)
def test_no_cross_no_fill():
    """a bid below the ask does not trade"""
    _, fills = _engine(_order("A", "sell", 1010, 100, "M1"),
                       _order("B", "buy", 1000, 100, "M2"))
    assert_eq(fills, [])


@stage(1)
def test_exact_match():
    """equal size and crossing price fills completely"""
    _, fills = _engine(_order("A", "sell", 1010, 100, "M1"),
                       _order("B", "buy", 1010, 100, "M2"))
    assert_eq(fills, [("B", "A", 100, 1010)])


@stage(1)
def test_trades_at_the_makers_price():
    """the resting order's price wins, so the taker gets price improvement"""
    _, fills = _engine(_order("A", "sell", 1010, 100, "M1"),
                       _order("B", "buy", 1050, 100, "M2"))
    assert_eq(fills, [("B", "A", 100, 1010)],
              "a buy at 1050 hitting a resting ask of 1010 trades at 1010")


@stage(1)
def test_partial_fill_of_taker():
    """a taker bigger than the book fills what it can"""
    _, fills = _engine(_order("A", "sell", 1010, 40, "M1"),
                       _order("B", "buy", 1010, 100, "M2"))
    assert_eq(fills, [("B", "A", 40, 1010)])


@stage(1)
def test_partial_fill_of_maker():
    """a smaller taker leaves the maker resting with the remainder"""
    engine, fills = _engine(_order("A", "sell", 1010, 100, "M1"),
                            _order("B", "buy", 1010, 30, "M2"))
    assert_eq(fills, [("B", "A", 30, 1010)])
    extra = engine.submit(_order("C", "buy", 1010, 70, "M3"))
    assert_eq(extra, [("C", "A", 70, 1010)], "the other 70 should still be resting")


@stage(1)
def test_price_priority():
    """the best price fills first regardless of arrival order"""
    _, fills = _engine(_order("A", "sell", 1020, 50, "M1"),
                       _order("B", "sell", 1010, 50, "M1"),
                       _order("C", "buy", 1020, 50, "M2"))
    assert_eq(fills, [("C", "B", 50, 1010)])


@stage(1)
def test_time_priority_at_same_price():
    """same price, earliest arrival fills first"""
    _, fills = _engine(_order("A", "sell", 1010, 50, "M1"),
                       _order("B", "sell", 1010, 50, "M1"),
                       _order("C", "buy", 1010, 50, "M2"))
    assert_eq(fills, [("C", "A", 50, 1010)])


@stage(1)
def test_sweeps_multiple_levels():
    """a large taker walks the book, each fill at its own maker's price"""
    _, fills = _engine(_order("A", "sell", 1010, 30, "M1"),
                       _order("B", "sell", 1020, 30, "M1"),
                       _order("C", "sell", 1030, 30, "M1"),
                       _order("D", "buy", 1025, 100, "M2"))
    assert_eq(fills, [("D", "A", 30, 1010), ("D", "B", 30, 1020)],
              "1030 is above the 1025 limit, so it should not trade")


@stage(1)
def test_sell_side_works_too():
    """an aggressive sell hits resting bids best-price-first"""
    _, fills = _engine(_order("A", "buy", 1000, 40, "M1"),
                       _order("B", "buy", 1010, 40, "M1"),
                       _order("C", "sell", 995, 100, "M2"))
    assert_eq(fills, [("C", "B", 40, 1010), ("C", "A", 40, 1000)])


# ------------------------------------------------------------------ part 2

@stage(2)
def test_cancel_removes_from_book():
    """a cancelled order cannot be hit"""
    engine, _ = _engine(_order("A", "sell", 1010, 100, "M1"))
    assert_eq(engine.cancel("A"), True)
    assert_eq(engine.submit(_order("B", "buy", 1010, 100, "M2")), [])


@stage(2)
def test_cancel_unknown_order():
    """cancelling something that was never submitted is False, not an exception"""
    engine, _ = _engine()
    assert_eq(engine.cancel("nope"), False)


@stage(2)
def test_cancel_is_not_idempotent():
    """the second cancel of the same order reports False"""
    engine, _ = _engine(_order("A", "sell", 1010, 100, "M1"))
    assert_eq([engine.cancel("A"), engine.cancel("A")], [True, False])


@stage(2)
def test_cannot_cancel_a_filled_order():
    """there is nothing left to cancel once it is done"""
    engine, _ = _engine(_order("A", "sell", 1010, 100, "M1"),
                        _order("B", "buy", 1010, 100, "M2"))
    assert_eq(engine.cancel("A"), False)


@stage(2)
def test_cancel_after_partial_fill():
    """cancelling a half-filled order removes only the remainder"""
    engine, _ = _engine(_order("A", "sell", 1010, 100, "M1"),
                        _order("B", "buy", 1010, 40, "M2"))
    assert_eq(engine.cancel("A"), True)
    assert_eq(engine.submit(_order("C", "buy", 1010, 60, "M3")), [])


@stage(2)
def test_book_aggregates_by_price():
    """two orders at one price show as a single level"""
    engine, _ = _engine(_order("A", "sell", 1010, 30, "M1"),
                        _order("B", "sell", 1010, 20, "M1"))
    assert_eq(engine.book(), {"bids": [], "asks": [(1010, 50)]})


@stage(2)
def test_book_is_sorted_best_first():
    """bids descend, asks ascend"""
    engine, _ = _engine(_order("A", "buy", 1000, 10, "M1"),
                        _order("B", "buy", 1005, 10, "M1"),
                        _order("C", "sell", 1020, 10, "M1"),
                        _order("D", "sell", 1015, 10, "M1"))
    assert_eq(engine.book(), {"bids": [(1005, 10), (1000, 10)],
                              "asks": [(1015, 10), (1020, 10)]})


@stage(2)
def test_book_excludes_cancelled_and_filled():
    """only live resting quantity counts"""
    engine, _ = _engine(_order("A", "sell", 1010, 100, "M1"),
                        _order("B", "sell", 1020, 50, "M1"),
                        _order("C", "buy", 1010, 100, "M2"))
    engine.cancel("B")
    assert_eq(engine.book(), {"bids": [], "asks": []})


@stage(2)
def test_taker_remainder_is_on_the_book():
    """what a taker could not trade rests and shows in depth"""
    engine, _ = _engine(_order("A", "sell", 1010, 40, "M1"),
                        _order("B", "buy", 1010, 100, "M2"))
    assert_eq(engine.book(), {"bids": [(1010, 60)], "asks": []})


# ------------------------------------------------------------------ part 3

@stage(3)
def test_market_order_sweeps():
    """a market buy takes whatever price the book offers"""
    _, fills = _engine(_order("A", "sell", 1010, 30, "M1"),
                       _order("B", "sell", 9999, 30, "M1"),
                       _order("C", "buy", None, 50, "M2"))
    assert_eq(fills, [("C", "A", 30, 1010), ("C", "B", 20, 9999)])


@stage(3)
def test_market_remainder_is_discarded():
    """an unfilled market order does not rest on the book"""
    engine, fills = _engine(_order("A", "sell", 1010, 30, "M1"),
                            _order("B", "buy", None, 100, "M2"))
    assert_eq(fills, [("B", "A", 30, 1010)])
    assert_eq(engine.book(), {"bids": [], "asks": []},
              "the leftover 70 of a market order must not become a resting bid")


@stage(3)
def test_market_order_into_empty_book():
    """nothing to trade with, nothing happens"""
    engine, fills = _engine(_order("A", "buy", None, 100, "M2"))
    assert_eq(fills, [])
    assert_eq(engine.book(), {"bids": [], "asks": []})


@stage(3)
def test_best_prices_and_spread():
    """top of book"""
    engine, _ = _engine(_order("A", "buy", 1000, 10, "M1"),
                        _order("B", "sell", 1012, 10, "M1"))
    assert_eq([engine.best_bid(), engine.best_ask(), engine.spread()], [1000, 1012, 12])


@stage(3)
def test_spread_needs_both_sides():
    """a one-sided book has no spread"""
    engine, _ = _engine(_order("A", "buy", 1000, 10, "M1"))
    assert_eq([engine.best_bid(), engine.best_ask(), engine.spread()], [1000, None, None])


@stage(3)
def test_top_of_book_ignores_cancelled():
    """cancelling the best bid promotes the next one"""
    engine, _ = _engine(_order("A", "buy", 1000, 10, "M1"),
                        _order("B", "buy", 1005, 10, "M1"))
    engine.cancel("B")
    assert_eq(engine.best_bid(), 1000)


@stage(3)
def test_self_trade_prevention():
    """a member never trades with its own resting order - the resting one is pulled"""
    engine, fills = _engine(_order("A", "sell", 1010, 50, "M1"),
                            _order("B", "buy", 1010, 50, "M1"))
    assert_eq(fills, [])
    assert_eq(engine.book(), {"bids": [(1010, 50)], "asks": []},
              "M1's resting ask should be cancelled and M1's bid should rest")


@stage(3)
def test_self_trade_prevention_then_continues():
    """after dropping its own order the taker keeps matching the rest of the book"""
    engine, fills = _engine(_order("A", "sell", 1010, 50, "M2"),
                            _order("B", "sell", 1015, 50, "M1"),
                            _order("C", "buy", 1020, 100, "M1"))
    assert_eq(fills, [("C", "A", 50, 1010)])
    assert_eq(engine.book(), {"bids": [(1020, 50)], "asks": []})
