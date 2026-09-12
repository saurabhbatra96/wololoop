# Tests for 06 - SaaS Billing and Proration.

PLAN = {"name": "pro", "base_cents": 9900, "per_seat_cents": 1500, "included_seats": 5}
MARCH = ("2026-03-01", "2026-04-01")       # 31 days


def _line(kind, seats, days, cents):
    return {"kind": kind, "seats": seats, "days": days, "cents": cents}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_base_fee_only():
    """seats inside the plan allowance cost nothing extra"""
    assert_eq(invoice(PLAN, 5, *MARCH),
              {"lines": [_line("base", None, 31, 9900)], "total_cents": 9900})


@stage(1)
def test_extra_seats_are_charged():
    """three seats over the allowance"""
    assert_eq(invoice(PLAN, 8, *MARCH),
              {"lines": [_line("base", None, 31, 9900), _line("seats", 8, 31, 4500)],
               "total_cents": 14400})


@stage(1)
def test_no_seat_line_when_nothing_to_charge():
    """an empty line item is noise on an invoice"""
    assert_eq(len(invoice(PLAN, 2, *MARCH)["lines"]), 1)


@stage(1)
def test_zero_seats():
    """a subscription with nobody in it still pays the base fee"""
    assert_eq(invoice(PLAN, 0, *MARCH)["total_cents"], 9900)


@stage(1)
def test_total_matches_the_lines():
    """the total is the sum of what's shown, not a separate calculation"""
    result = invoice(PLAN, 12, *MARCH)
    assert_eq(result["total_cents"], sum(line["cents"] for line in result["lines"]))


@stage(1)
def test_period_length_is_recorded():
    """a 28 day February bills the same base fee over fewer days"""
    result = invoice(PLAN, 8, "2026-02-01", "2026-03-01")
    assert_eq([line["days"] for line in result["lines"]], [28, 28])


# ------------------------------------------------------------------ part 2

@stage(2)
def test_no_change_matches_a_flat_invoice():
    """one segment covering the whole period is just the part 1 answer"""
    changes = [{"date": "2026-03-01", "seats": 8}]
    assert_eq(prorate(PLAN, changes, *MARCH)["total_cents"], 14400)


@stage(2)
def test_upgrade_mid_period():
    """8 seats for 15 days, then 13 for 16"""
    changes = [{"date": "2026-03-01", "seats": 8}, {"date": "2026-03-16", "seats": 13}]
    assert_eq(prorate(PLAN, changes, *MARCH), {
        "lines": [_line("base", None, 31, 9900),
                  _line("seats", 8, 15, 2177),
                  _line("seats", 13, 16, 6194)],
        "total_cents": 18271,
    })


@stage(2)
def test_rounds_once_per_line():
    """8 chargeable seats for 16/31 days is 6193.55 cents, billed as 6194"""
    changes = [{"date": "2026-03-01", "seats": 5}, {"date": "2026-03-16", "seats": 13}]
    line = [l for l in prorate(PLAN, changes, *MARCH)["lines"] if l["kind"] == "seats"]
    assert_eq(line, [_line("seats", 13, 16, 6194)])


@stage(2)
def test_downgrade_mid_period():
    """dropping back inside the allowance stops the seat charge"""
    changes = [{"date": "2026-03-01", "seats": 13}, {"date": "2026-03-16", "seats": 4}]
    result = prorate(PLAN, changes, *MARCH)
    assert_eq([l["cents"] for l in result["lines"]], [9900, 5806])


@stage(2)
def test_change_before_the_period_is_clamped():
    """a seat count set in February applies from 1 March"""
    changes = [{"date": "2026-02-10", "seats": 8}]
    assert_eq(prorate(PLAN, changes, *MARCH)["total_cents"], 14400)


@stage(2)
def test_two_changes_on_one_day():
    """the last change of the day is the one that stands"""
    changes = [{"date": "2026-03-01", "seats": 8},
               {"date": "2026-03-16", "seats": 50},
               {"date": "2026-03-16", "seats": 13}]
    assert_eq(prorate(PLAN, changes, *MARCH)["total_cents"], 18271)


@stage(2)
def test_changes_arrive_unsorted():
    """the list order is not the timeline"""
    changes = [{"date": "2026-03-16", "seats": 13}, {"date": "2026-03-01", "seats": 8}]
    assert_eq(prorate(PLAN, changes, *MARCH)["total_cents"], 18271)


@stage(2)
def test_base_fee_is_never_prorated_here():
    """no matter how the seats move, the base fee is a whole period charge"""
    changes = [{"date": "2026-03-01", "seats": 8}, {"date": "2026-03-20", "seats": 40}]
    base = [l for l in prorate(PLAN, changes, *MARCH)["lines"] if l["kind"] == "base"]
    assert_eq(base, [_line("base", None, 31, 9900)])


# ------------------------------------------------------------------ part 3

def _events():
    return [
        {"event_id": "e2", "type": "change_seats", "at": "2026-03-16", "seats": 13},
        {"event_id": "e1", "type": "subscribe", "at": "2026-03-01", "seats": 8},
    ]


@stage(3)
def test_replays_out_of_order_events():
    """the webhook delivered the upgrade before the signup"""
    assert_eq(replay(PLAN, _events(), *MARCH)["total_cents"], 18271)


@stage(3)
def test_duplicate_events_are_ignored():
    """at-least-once delivery must not bill twice"""
    events = _events() + [dict(_events()[0]), dict(_events()[1])]
    assert_eq(replay(PLAN, events, *MARCH)["total_cents"], 18271)


@stage(3)
def test_replay_is_deterministic_under_shuffling():
    """any delivery order produces the same invoice"""
    events = _events()
    assert_eq(replay(PLAN, events, *MARCH), replay(PLAN, list(reversed(events)), *MARCH))


@stage(3)
def test_cancel_stops_the_seat_charge_and_credits_the_base():
    """cancelled on the 21st: 20 days kept, 11 days credited"""
    events = _events() + [{"event_id": "e3", "type": "cancel", "at": "2026-03-21"}]
    assert_eq(replay(PLAN, events, *MARCH), {
        "lines": [_line("base", None, 31, 9900),
                  _line("seats", 8, 15, 2177),
                  _line("seats", 13, 5, 1935),
                  _line("credit", None, 11, -3513)],
        "total_cents": 10499,
    })


@stage(3)
def test_nothing_happens_after_a_cancel():
    """a seat change that arrives after cancellation changes nothing"""
    events = _events() + [
        {"event_id": "e3", "type": "cancel", "at": "2026-03-21"},
        {"event_id": "e4", "type": "change_seats", "at": "2026-03-25", "seats": 99},
    ]
    assert_eq(replay(PLAN, events, *MARCH)["total_cents"], 10499)


@stage(3)
def test_cancel_after_the_period_ends_is_not_a_credit():
    """they had the whole month"""
    events = _events() + [{"event_id": "e3", "type": "cancel", "at": "2026-04-15"}]
    result = replay(PLAN, events, *MARCH)
    assert_eq([l["kind"] for l in result["lines"]], ["base", "seats", "seats"])


@stage(3)
def test_no_subscription_means_no_invoice():
    """don't bill someone who was never a customer this period"""
    assert_eq(replay(PLAN, [], *MARCH), {"lines": [], "total_cents": 0})


@stage(3)
def test_subscription_starting_before_the_period():
    """an existing customer is billed for the whole month"""
    events = [{"event_id": "e1", "type": "subscribe", "at": "2026-01-05", "seats": 8}]
    assert_eq(replay(PLAN, events, *MARCH)["total_cents"], 14400)


@stage(3)
def test_credit_makes_the_total_add_up():
    """the credit line is part of the total, not a footnote"""
    events = _events() + [{"event_id": "e3", "type": "cancel", "at": "2026-03-10"}]
    result = replay(PLAN, events, *MARCH)
    assert_eq(result["total_cents"], sum(l["cents"] for l in result["lines"]))
