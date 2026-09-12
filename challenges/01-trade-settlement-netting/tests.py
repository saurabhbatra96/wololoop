# Tests for 01 - Trade Settlement Netting.
# These run against whatever you have defined in the editor.

BLOTTER = [
    {"trade_id": "T1", "buyer": "ALPHA", "seller": "BRAVO", "symbol": "ACME",
     "quantity": 100, "price_cents": 1050, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T2", "buyer": "BRAVO", "seller": "CIRRUS", "symbol": "ACME",
     "quantity": 40, "price_cents": 1100, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T3", "buyer": "CIRRUS", "seller": "ALPHA", "symbol": "ZINC",
     "quantity": 25, "price_cents": 2000, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T4", "buyer": "ALPHA", "seller": "BRAVO", "symbol": "ACME",
     "quantity": 100, "price_cents": 1000, "currency": "USD", "trade_date": "2026-03-02"},
    {"trade_id": "T5", "buyer": "BRAVO", "seller": "ALPHA", "symbol": "ZINC",
     "quantity": 25, "price_cents": 1900, "currency": "USD", "trade_date": "2026-03-02"},
]

FX = {"USD": "1", "EUR": "1.0850", "GBP": "1.2740", "CHF": "1.2500"}


def _trade(tid, buyer, seller, qty, price, date, currency="USD", symbol="ACME"):
    return {"trade_id": tid, "buyer": buyer, "seller": seller, "symbol": symbol,
            "quantity": qty, "price_cents": price, "currency": currency, "trade_date": date}


# ------------------------------------------------------------------ part 1

@stage(1)
def test_single_trade_nets_both_sides():
    """a single trade moves both members' positions"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")]
    assert_eq(net_positions(trades), {("ALPHA", "ACME"): 100, ("BRAVO", "ACME"): -100})


@stage(1)
def test_worked_example():
    """the worked example from the brief"""
    assert_eq(net_positions(BLOTTER), {
        ("ALPHA", "ACME"): 200, ("ALPHA", "ZINC"): -50,
        ("BRAVO", "ACME"): -160, ("BRAVO", "ZINC"): 25,
        ("CIRRUS", "ACME"): -40, ("CIRRUS", "ZINC"): 25,
    })


@stage(1)
def test_flat_pairs_are_dropped():
    """a member who buys then sells the same quantity disappears"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02"),
              _trade("A2", "BRAVO", "ALPHA", 100, 700, "2026-03-02")]
    assert_eq(net_positions(trades), {})


@stage(1)
def test_positions_are_per_symbol():
    """the same two members trading two symbols stay separate"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02", symbol="ACME"),
              _trade("A2", "ALPHA", "BRAVO", 30, 500, "2026-03-02", symbol="ZINC")]
    assert_eq(net_positions(trades), {
        ("ALPHA", "ACME"): 100, ("BRAVO", "ACME"): -100,
        ("ALPHA", "ZINC"): 30, ("BRAVO", "ZINC"): -30,
    })


@stage(1)
def test_duplicate_trade_ids_counted_once():
    """the same trade_id appearing twice is booked once"""
    dupe = _trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")
    assert_eq(net_positions([dupe, dict(dupe)]),
              {("ALPHA", "ACME"): 100, ("BRAVO", "ACME"): -100})


@stage(1)
def test_empty_blotter():
    """an empty blotter nets to nothing"""
    assert_eq(net_positions([]), {})


@stage(1)
def test_does_not_mutate_input():
    """the caller's blotter comes back untouched"""
    trades = [dict(t) for t in BLOTTER]
    before = [dict(t) for t in trades]
    net_positions(trades)
    assert_eq(trades, before, "you modified the blotter that was passed in")


# ------------------------------------------------------------------ part 2

@stage(2)
def test_cash_single_trade():
    """the buyer owes, the seller is owed"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")]
    assert_eq(net_cash(trades), {"ALPHA": -50000, "BRAVO": 50000})


@stage(2)
def test_cash_worked_example():
    """net cash for the worked example"""
    assert_eq(net_cash(BLOTTER), {"ALPHA": -107500, "BRAVO": 113500, "CIRRUS": -6000})


@stage(2)
def test_cash_drops_flat_members():
    """a member whose cash nets to zero is not in the result"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02"),
              _trade("A2", "BRAVO", "ALPHA", 50, 1000, "2026-03-02")]
    assert_eq(net_cash(trades), {})


@stage(2)
def test_cash_sums_to_zero():
    """every cent owed is a cent due"""
    assert_eq(sum(net_cash(BLOTTER).values()), 0)


@stage(2)
def test_transfers_worked_example():
    """largest debt against largest credit, in order"""
    assert_eq(settlement_transfers(net_cash(BLOTTER)),
              [("ALPHA", "BRAVO", 107500), ("CIRRUS", "BRAVO", 6000)])


@stage(2)
def test_transfers_conserve_every_balance():
    """after the transfers run, everybody is square"""
    net = net_cash(BLOTTER)
    balances = dict(net)
    for payer, payee, amount in settlement_transfers(net):
        balances[payer] = balances.get(payer, 0) + amount
        balances[payee] = balances.get(payee, 0) - amount
    assert_eq({m: b for m, b in balances.items() if b != 0}, {},
              "these members are still out of pocket after settlement")


@stage(2)
def test_transfers_break_ties_alphabetically():
    """equal debts settle in name order, so the output is deterministic"""
    assert_eq(settlement_transfers({"A": -100, "B": -100, "C": 200}),
              [("A", "C", 100), ("B", "C", 100)])
    assert_eq(settlement_transfers({"A": 100, "B": 100, "C": -200}),
              [("C", "A", 100), ("C", "B", 100)])


@stage(2)
def test_transfers_at_most_n_minus_one():
    """n members never need more than n-1 payments"""
    net = net_cash(BLOTTER)
    transfers = settlement_transfers(net)
    assert len(transfers) <= len(net) - 1, \
        "%d transfers for %d members - the greedy should never exceed n-1" % (len(transfers), len(net))


@stage(2)
def test_transfers_are_well_formed():
    """no self-payments, no zero or negative amounts"""
    for payer, payee, amount in settlement_transfers(net_cash(BLOTTER)):
        assert payer != payee, "%s is paying itself" % payer
        assert amount > 0, "transfer of %d cents from %s to %s" % (amount, payer, payee)


@stage(2)
def test_transfers_when_nothing_is_owed():
    """a flat book needs no payments"""
    assert_eq(settlement_transfers({}), [])


@stage(2)
def test_one_debtor_pays_several_creditors():
    """a single large debt is split across creditors"""
    assert_eq(settlement_transfers({"A": -300, "B": 200, "C": 100}),
              [("A", "B", 200), ("A", "C", 100)])


# ------------------------------------------------------------------ part 3

@stage(3)
def test_settles_t_plus_two():
    """a Monday trade settles on Wednesday"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")]
    assert_eq(settlement_plan(trades, FX), {"2026-03-04": [("ALPHA", "BRAVO", 50000)]})


@stage(3)
def test_skips_the_weekend():
    """a Thursday trade settles on Monday"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-05")]
    assert_eq(settlement_plan(trades, FX), {"2026-03-09": [("ALPHA", "BRAVO", 50000)]})


@stage(3)
def test_skips_a_holiday():
    """a closed Wednesday pushes settlement to Thursday"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")]
    assert_eq(settlement_plan(trades, FX, {"2026-03-04"}),
              {"2026-03-05": [("ALPHA", "BRAVO", 50000)]})


@stage(3)
def test_converts_to_usd():
    """a EUR trade settles in USD cents"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 25, 2000, "2026-03-02", currency="EUR")]
    assert_eq(settlement_plan(trades, FX), {"2026-03-04": [("ALPHA", "BRAVO", 54250)]})


@stage(3)
def test_rounds_half_up_not_bankers():
    """exactly half a cent rounds away from zero"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 10, 5, "2026-03-02", currency="CHF")]
    assert_eq(settlement_plan(trades, FX), {"2026-03-04": [("ALPHA", "BRAVO", 63)]},
              "50 CHF cents at 1.25 is 62.5 - round half up gives 63, "
              "Python's built-in round() gives 62")


@stage(3)
def test_nets_inside_each_settlement_date():
    """the full multi-currency, multi-date example"""
    trades = [
        _trade("X1", "ALPHA", "BRAVO", 100, 1050, "2026-03-02", symbol="ACME"),
        _trade("X2", "CIRRUS", "ALPHA", 25, 2000, "2026-03-02", "EUR", "ZINC"),
        _trade("X3", "BRAVO", "CIRRUS", 40, 1100, "2026-03-05", "GBP", "ACME"),
        _trade("X4", "ALPHA", "BRAVO", 3, 333, "2026-03-06", "EUR", "ZINC"),
    ]
    assert_eq(settlement_plan(trades, FX, {"2026-03-04"}), {
        "2026-03-05": [("CIRRUS", "BRAVO", 54250), ("ALPHA", "BRAVO", 50750)],
        "2026-03-09": [("BRAVO", "CIRRUS", 56056)],
        "2026-03-10": [("ALPHA", "BRAVO", 1084)],
    })


@stage(3)
def test_dates_that_net_flat_are_omitted():
    """a settlement date with nothing to pay does not appear"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 1000, "2026-03-02"),
              _trade("A2", "BRAVO", "ALPHA", 100, 1000, "2026-03-02"),
              _trade("A3", "ALPHA", "BRAVO", 10, 1000, "2026-03-03")]
    assert_eq(settlement_plan(trades, FX), {"2026-03-05": [("ALPHA", "BRAVO", 10000)]})


@stage(3)
def test_duplicates_still_ignored():
    """dedupe survives into part 3"""
    dupe = _trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")
    assert_eq(settlement_plan([dupe, dict(dupe)], FX),
              {"2026-03-04": [("ALPHA", "BRAVO", 50000)]})


@stage(3)
def test_plan_does_not_mutate_input():
    """the caller's blotter is still intact"""
    trades = [_trade("A1", "ALPHA", "BRAVO", 100, 500, "2026-03-02")]
    before = [dict(t) for t in trades]
    settlement_plan(trades, FX)
    assert_eq(trades, before, "you modified the blotter that was passed in")
