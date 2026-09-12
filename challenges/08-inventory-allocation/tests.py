# Tests for 08 - Inventory Allocation.

TODAY = "2026-06-01"


def _lot(lot_id, sku, qty, expires, received="2026-01-01", warehouse="W1"):
    return {"lot_id": lot_id, "sku": sku, "warehouse": warehouse, "quantity": qty,
            "received_at": received, "expires_at": expires}


def _order(order_id, sku, qty, region="north"):
    return {"order_id": order_id, "sku": sku, "quantity": qty, "region": region}


DISTANCES = {("W1", "north"): 100, ("W2", "north"): 250, ("W3", "north"): 100}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_single_lot_covers_the_order():
    """straightforward pick"""
    lots = [_lot("L1", "TEA", 100, "2026-09-01")]
    assert_eq(allocate(lots, [_order("O1", "TEA", 40)], TODAY),
              {"allocations": {"O1": [("L1", 40)]}, "shortfalls": {}})


@stage(1)
def test_soonest_expiry_goes_first():
    """FEFO: ship the stock that dies first, not the stock that arrived first"""
    lots = [_lot("L1", "TEA", 100, "2026-09-01", received="2026-01-01"),
            _lot("L2", "TEA", 100, "2026-07-01", received="2026-05-01")]
    assert_eq(allocate(lots, [_order("O1", "TEA", 40)], TODAY)["allocations"],
              {"O1": [("L2", 40)]})


@stage(1)
def test_order_spans_several_lots():
    """take what the first lot has, then move on"""
    lots = [_lot("L1", "TEA", 30, "2026-07-01"), _lot("L2", "TEA", 50, "2026-08-01")]
    assert_eq(allocate(lots, [_order("O1", "TEA", 60)], TODAY)["allocations"],
              {"O1": [("L1", 30), ("L2", 30)]})


@stage(1)
def test_expired_lots_are_not_shipped():
    """stock that expired last month is not inventory"""
    lots = [_lot("L1", "TEA", 100, "2026-05-01"), _lot("L2", "TEA", 20, "2026-08-01")]
    result = allocate(lots, [_order("O1", "TEA", 50)], TODAY)
    assert_eq(result, {"allocations": {"O1": [("L2", 20)]}, "shortfalls": {"O1": 30}})


@stage(1)
def test_expiring_today_is_too_late():
    """a lot expiring on the allocation date cannot go out"""
    lots = [_lot("L1", "TEA", 100, TODAY)]
    assert_eq(allocate(lots, [_order("O1", "TEA", 10)], TODAY),
              {"allocations": {"O1": []}, "shortfalls": {"O1": 10}})


@stage(1)
def test_orders_consume_in_sequence():
    """the first order takes its stock and the second sees what's left"""
    lots = [_lot("L1", "TEA", 50, "2026-07-01")]
    orders = [_order("O1", "TEA", 30), _order("O2", "TEA", 30)]
    assert_eq(allocate(lots, orders, TODAY),
              {"allocations": {"O1": [("L1", 30)], "O2": [("L1", 20)]},
               "shortfalls": {"O2": 10}})


@stage(1)
def test_skus_do_not_mix():
    """coffee is not tea"""
    lots = [_lot("L1", "COFFEE", 100, "2026-07-01")]
    assert_eq(allocate(lots, [_order("O1", "TEA", 10)], TODAY),
              {"allocations": {"O1": []}, "shortfalls": {"O1": 10}})


@stage(1)
def test_same_expiry_breaks_on_received_then_id():
    """two lots dying the same day: the older receipt goes first"""
    lots = [_lot("L9", "TEA", 10, "2026-07-01", received="2026-05-01"),
            _lot("L2", "TEA", 10, "2026-07-01", received="2026-03-01")]
    assert_eq(allocate(lots, [_order("O1", "TEA", 15)], TODAY)["allocations"],
              {"O1": [("L2", 10), ("L9", 5)]})


@stage(1)
def test_no_stock_at_all():
    """nothing to give"""
    assert_eq(allocate([], [_order("O1", "TEA", 10)], TODAY),
              {"allocations": {"O1": []}, "shortfalls": {"O1": 10}})


# ------------------------------------------------------------------ part 2

@stage(2)
def test_nearest_warehouse_when_both_can_fill():
    """W1 is closer than W2"""
    lots = [_lot("L1", "TEA", 100, "2026-07-01", warehouse="W1"),
            _lot("L2", "TEA", 100, "2026-07-01", warehouse="W2")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 40)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W1", "L1", 40)]})


@stage(2)
def test_one_shipment_beats_a_shorter_one():
    """the near warehouse is short, so send it all from the far one"""
    lots = [_lot("L1", "TEA", 10, "2026-07-01", warehouse="W1"),
            _lot("L2", "TEA", 100, "2026-07-01", warehouse="W2")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 40)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W2", "L2", 40)]},
              "splitting a parcel costs more than the extra 150km")


@stage(2)
def test_equidistant_warehouses_break_on_name():
    """W1 and W3 are both 100km away"""
    lots = [_lot("L3", "TEA", 100, "2026-07-01", warehouse="W3"),
            _lot("L1", "TEA", 100, "2026-07-01", warehouse="W1")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 40)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W1", "L1", 40)]})


@stage(2)
def test_splits_nearest_first_when_nobody_can_cover():
    """no single warehouse has 120, so start with the closest"""
    lots = [_lot("L1", "TEA", 50, "2026-07-01", warehouse="W1"),
            _lot("L2", "TEA", 50, "2026-07-01", warehouse="W2"),
            _lot("L3", "TEA", 50, "2026-07-01", warehouse="W3")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 120)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W1", "L1", 50), ("W3", "L3", 50), ("W2", "L2", 20)]})


@stage(2)
def test_unreachable_warehouses_are_ignored():
    """no distance on file means we cannot ship from there"""
    lots = [_lot("L4", "TEA", 100, "2026-07-01", warehouse="W4")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 40)], DISTANCES, TODAY),
              {"allocations": {"O1": []}, "shortfalls": {"O1": 40}})


@stage(2)
def test_fefo_still_applies_inside_a_warehouse():
    """nearest warehouse, then soonest expiry within it"""
    lots = [_lot("L1", "TEA", 20, "2026-09-01", warehouse="W1"),
            _lot("L2", "TEA", 20, "2026-07-01", warehouse="W1")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 30)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W1", "L2", 20), ("W1", "L1", 10)]})


@stage(2)
def test_shortfall_after_exhausting_everywhere():
    """even split across the network isn't enough"""
    lots = [_lot("L1", "TEA", 10, "2026-07-01", warehouse="W1"),
            _lot("L2", "TEA", 10, "2026-07-01", warehouse="W2")]
    result = allocate_multi(lots, [_order("O1", "TEA", 50)], DISTANCES, TODAY)
    assert_eq(result["shortfalls"], {"O1": 30})


@stage(2)
def test_expired_stock_does_not_make_a_warehouse_eligible():
    """W1 looks stocked but it's all dead"""
    lots = [_lot("L1", "TEA", 100, "2026-05-01", warehouse="W1"),
            _lot("L2", "TEA", 100, "2026-07-01", warehouse="W2")]
    assert_eq(allocate_multi(lots, [_order("O1", "TEA", 40)], DISTANCES, TODAY)["allocations"],
              {"O1": [("W2", "L2", 40)]})


# ------------------------------------------------------------------ part 3

def _ledger(quantity=100, expires="2026-09-01"):
    return ReservationLedger([_lot("L1", "TEA", quantity, expires)], TODAY)


@stage(3)
def test_available_starts_at_stock_on_hand():
    """nothing held yet"""
    assert_eq(_ledger().available("TEA", 1000), 100)


@stage(3)
def test_expired_lots_are_not_available():
    """dead stock is not sellable"""
    assert_eq(_ledger(expires="2026-05-01").available("TEA", 1000), 0)


@stage(3)
def test_reserving_holds_stock():
    """a checkout in progress takes the units off the shelf"""
    ledger = _ledger()
    assert_eq(ledger.reserve("O1", "TEA", 30, 1000, 600), True)
    assert_eq(ledger.available("TEA", 1000), 70)


@stage(3)
def test_cannot_oversell():
    """the second reservation cannot have what the first is holding"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 80, 1000, 600)
    assert_eq(ledger.reserve("O2", "TEA", 30, 1000, 600), False)
    assert_eq(ledger.available("TEA", 1000), 20)


@stage(3)
def test_holds_lapse_on_their_own():
    """an abandoned basket releases the stock without anyone sweeping"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 80, 1000, 600)
    assert_eq(ledger.available("TEA", 1601), 100)


@stage(3)
def test_expiry_is_inclusive():
    """a hold expiring exactly now is already gone"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 80, 1000, 600)
    assert_eq(ledger.available("TEA", 1600), 100)


@stage(3)
def test_confirm_keeps_the_stock_forever():
    """once paid for, the units never come back"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    assert_eq(ledger.confirm("O1", 1200), True)
    assert_eq(ledger.available("TEA", 99999), 70)


@stage(3)
def test_cannot_confirm_a_lapsed_hold():
    """too slow - the stock may already be promised to someone else"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    assert_eq(ledger.confirm("O1", 1601), False)


@stage(3)
def test_cancel_releases_stock():
    """abandoning checkout puts it back immediately"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    assert_eq(ledger.cancel("O1"), True)
    assert_eq(ledger.available("TEA", 1000), 100)


@stage(3)
def test_cannot_cancel_a_confirmed_order():
    """that's a refund, not a cancellation, and it isn't this function's job"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    ledger.confirm("O1", 1100)
    assert_eq(ledger.cancel("O1"), False)


@stage(3)
def test_unknown_order_ids():
    """nothing to confirm, nothing to cancel"""
    ledger = _ledger()
    assert_eq([ledger.confirm("nope", 1000), ledger.cancel("nope")], [False, False])


@stage(3)
def test_duplicate_reservation_is_refused():
    """the same order must not hold stock twice"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    assert_eq(ledger.reserve("O1", "TEA", 30, 1000, 600), False)
    assert_eq(ledger.available("TEA", 1000), 70)


@stage(3)
def test_retry_after_a_lapsed_hold():
    """the customer came back - let them reserve again"""
    ledger = _ledger()
    ledger.reserve("O1", "TEA", 30, 1000, 600)
    assert_eq(ledger.reserve("O1", "TEA", 30, 2000, 600), True)
    assert_eq(ledger.available("TEA", 2000), 70)
