# Tests for 10 - Health Claims Adjudication.

PLAN = {"deductible_cents": 50000, "coinsurance_rate": "0.20",
        "oop_max_cents": 80000, "family_oop_max_cents": 120000}

BIG_CAPS = dict(PLAN, oop_max_cents=10 ** 9, family_oop_max_cents=10 ** 9)


def _claim(claim_id, member, date, billed):
    return {"claim_id": claim_id, "member_id": member,
            "service_date": date, "billed_cents": billed}


def _paid(results):
    return [(r["claim_id"], r["member_pays_cents"], r["plan_pays_cents"]) for r in results]


# ------------------------------------------------------------------ part 1

@stage(1)
def test_first_claim_is_all_deductible():
    """below the deductible, the member pays everything"""
    claims = [_claim("C1", "m1", "2026-01-10", 30000)]
    assert_eq(_paid(adjudicate(PLAN, claims)), [("C1", 30000, 0)])


@stage(1)
def test_claim_straddles_the_deductible():
    """50000 of deductible, then 20% of the remaining 50000"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000)]
    assert_eq(_paid(adjudicate(PLAN, claims)), [("C1", 60000, 40000)])


@stage(1)
def test_deductible_carries_across_claims():
    """the second claim only faces what is left of the deductible"""
    claims = [_claim("C1", "m1", "2026-01-10", 30000),
              _claim("C2", "m1", "2026-02-10", 30000)]
    assert_eq(_paid(adjudicate(PLAN, claims)), [("C1", 30000, 0), ("C2", 22000, 8000)])


@stage(1)
def test_after_the_deductible_only_coinsurance():
    """deductible spent, member pays their 20% share"""
    claims = [_claim("C1", "m1", "2026-01-10", 50000),
              _claim("C2", "m1", "2026-02-10", 40000)]
    assert_eq(_paid(adjudicate(PLAN, claims))[1], ("C2", 8000, 32000))


@stage(1)
def test_service_date_order_not_list_order():
    """a claim listed second but dated first is adjudicated first"""
    claims = [_claim("C2", "m1", "2026-02-10", 30000),
              _claim("C1", "m1", "2026-01-10", 30000)]
    assert_eq(_paid(adjudicate(PLAN, claims)), [("C1", 30000, 0), ("C2", 22000, 8000)])


@stage(1)
def test_coinsurance_rounds_half_up():
    """10% of 12345 is 1234.5 cents and the member pays 1235"""
    plan = dict(PLAN, deductible_cents=0, coinsurance_rate="0.10")
    claims = [_claim("C1", "m1", "2026-01-10", 12345)]
    assert_eq(_paid(adjudicate(plan, claims)), [("C1", 1235, 11110)],
              "round(1234.5) gives 1234 - bankers rounding is the wrong rule here")


@stage(1)
def test_zero_billed_claim():
    """a zero dollar claim costs nobody anything"""
    assert_eq(_paid(adjudicate(PLAN, [_claim("C1", "m1", "2026-01-10", 0)])),
              [("C1", 0, 0)])


@stage(1)
def test_member_and_plan_always_sum_to_billed():
    """not one cent may go missing"""
    claims = [_claim("C1", "m1", "2026-01-10", 33333),
              _claim("C2", "m1", "2026-02-10", 77777)]
    for claim, result in zip([33333, 77777], adjudicate(PLAN, claims)):
        assert_eq(result["member_pays_cents"] + result["plan_pays_cents"], claim)


# ------------------------------------------------------------------ part 2

@stage(2)
def test_matches_part_one_below_the_caps():
    """the caps only bite once somebody reaches them"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000)]
    assert_eq(_paid(adjudicate_family(BIG_CAPS, claims)), [("C1", 60000, 40000)])


@stage(2)
def test_individual_out_of_pocket_max():
    """m1 hits 80000 and the plan pays everything after that"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000)]
    assert_eq(_paid(adjudicate_family(PLAN, claims)),
              [("C1", 60000, 40000), ("C2", 20000, 80000), ("C3", 0, 50000)])


@stage(2)
def test_cap_is_partial_on_the_claim_that_crosses_it():
    """the member pays only up to the cap, not the whole coinsurance"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000)]
    assert_eq(_paid(adjudicate_family(PLAN, claims))[1], ("C2", 20000, 80000))


@stage(2)
def test_members_have_their_own_deductible():
    """m2 starts the year fresh"""
    claims = [_claim("C1", "m1", "2026-01-10", 50000),
              _claim("C2", "m2", "2026-02-10", 50000)]
    assert_eq(_paid(adjudicate_family(BIG_CAPS, claims)),
              [("C1", 50000, 0), ("C2", 50000, 0)])


@stage(2)
def test_family_max_covers_everyone():
    """m1 is capped out, then the family cap stops m2 too"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000),
              _claim("C4", "m2", "2026-04-10", 100000),
              _claim("C5", "m2", "2026-05-10", 50000)]
    assert_eq(_paid(adjudicate_family(PLAN, claims)),
              [("C1", 60000, 40000), ("C2", 20000, 80000), ("C3", 0, 50000),
               ("C4", 40000, 60000), ("C5", 0, 50000)])


@stage(2)
def test_deductible_credited_only_for_money_actually_paid():
    """a capped claim does not satisfy a deductible the member never paid"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000),
              _claim("C3", "m2", "2026-03-10", 100000),
              _claim("C4", "m2", "2026-04-10", 30000)]
    results = _paid(adjudicate_family(PLAN, claims))
    assert_eq(results[2], ("C3", 40000, 60000),
              "the family cap limits m2's first claim to 40000")
    assert_eq(results[3], ("C4", 0, 30000))


@stage(2)
def test_nobody_ever_pays_a_negative_amount():
    """once capped out, the member's share is zero, not a refund"""
    claims = [_claim("C%d" % i, "m1", "2026-0%d-10" % i, 100000) for i in range(1, 6)]
    for result in adjudicate_family(PLAN, claims):
        assert result["member_pays_cents"] >= 0, result


@stage(2)
def test_totals_still_reconcile():
    """member plus plan equals billed, on every claim"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000)]
    for claim, result in zip(claims, adjudicate_family(PLAN, claims)):
        assert_eq(result["member_pays_cents"] + result["plan_pays_cents"],
                  claim["billed_cents"])


# ------------------------------------------------------------------ part 3

def _previous():
    return adjudicate_family(PLAN, [_claim("C1", "m1", "2026-01-10", 100000),
                                    _claim("C3", "m1", "2026-03-10", 50000)])


@stage(3)
def test_nothing_changed_means_no_adjustments():
    """a rerun on the same data is silent"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000)]
    assert_eq(reprocess(PLAN, claims, _previous())["adjustments"], [])


@stage(3)
def test_late_claim_reopens_the_ones_after_it():
    """February arrives in April and March has to be repriced"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000),
              _claim("C2", "m1", "2026-02-10", 100000)]
    result = reprocess(PLAN, claims, _previous())
    assert_eq(_paid(result["results"]),
              [("C1", 60000, 40000), ("C2", 20000, 80000), ("C3", 0, 50000)])
    assert_eq(result["adjustments"],
              [{"claim_id": "C2", "member_delta_cents": 20000, "plan_delta_cents": 80000},
               {"claim_id": "C3", "member_delta_cents": -10000, "plan_delta_cents": 10000}],
              "C3 was already paid at 10000; the late claim pushed m1 to the cap")


@stage(3)
def test_reversal_removes_a_claim():
    """January was billed in error"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000),
              {"claim_id": "R1", "type": "reversal", "reverses": "C1"}]
    result = reprocess(PLAN, claims, _previous())
    assert_eq(_paid(result["results"]), [("C3", 50000, 0)])
    assert_eq(result["adjustments"],
              [{"claim_id": "C1", "member_delta_cents": -60000, "plan_delta_cents": -40000},
               {"claim_id": "C3", "member_delta_cents": 40000, "plan_delta_cents": -40000}])


@stage(3)
def test_reversal_itself_is_not_a_claim():
    """the reversal record never appears in the results"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              {"claim_id": "R1", "type": "reversal", "reverses": "C1"}]
    assert_eq(reprocess(PLAN, claims, [])["results"], [])


@stage(3)
def test_reversal_of_an_unknown_claim_is_harmless():
    """reversing something we never had changes nothing"""
    claims = [_claim("C1", "m1", "2026-01-10", 30000),
              {"claim_id": "R9", "type": "reversal", "reverses": "NOPE"}]
    assert_eq(_paid(reprocess(PLAN, claims, [])["results"]), [("C1", 30000, 0)])


@stage(3)
def test_a_brand_new_claim_only_adjusts_itself():
    """appending a later claim does not disturb the earlier ones"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C3", "m1", "2026-03-10", 50000),
              _claim("C9", "m1", "2026-09-10", 10000)]
    adjustments = reprocess(PLAN, claims, _previous())["adjustments"]
    assert_eq([a["claim_id"] for a in adjustments], ["C9"])


@stage(3)
def test_adjustments_are_sorted_by_claim_id():
    """finance reads these in order"""
    claims = [_claim("C5", "m1", "2026-05-10", 20000),
              _claim("C2", "m1", "2026-02-10", 20000)]
    adjustments = reprocess(PLAN, claims, [])["adjustments"]
    assert_eq([a["claim_id"] for a in adjustments], ["C2", "C5"])


@stage(3)
def test_results_stay_in_service_date_order():
    """the output is a timeline, whatever order the claims arrived in"""
    claims = [_claim("C9", "m1", "2026-09-10", 10000),
              _claim("C1", "m1", "2026-01-10", 10000)]
    assert_eq([r["claim_id"] for r in reprocess(PLAN, claims, [])["results"]], ["C1", "C9"])


@stage(3)
def test_reprocessing_is_idempotent():
    """feeding the output back in produces no further adjustments"""
    claims = [_claim("C1", "m1", "2026-01-10", 100000),
              _claim("C2", "m1", "2026-02-10", 100000)]
    once = reprocess(PLAN, claims, [])
    twice = reprocess(PLAN, claims, once["results"])
    assert_eq(twice["adjustments"], [])
