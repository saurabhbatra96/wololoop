"""Reference solution - 10 Health Claims Adjudication.

Adjudication is a fold over an ordered list of claims where the accumulator is
the member's year to date. Two things make it interesting:

  * The order is the *service* date, not the arrival date - so a claim that
    turns up three weeks late changes the answer for claims already paid.
  * Because of that, the only sane implementation is to recompute the year from
    scratch and emit the *differences*. Trying to patch accumulators in place
    is how claims systems end up unable to explain their own numbers.
"""

from decimal import Decimal, ROUND_HALF_UP


def _half_up(value):
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _ordered(claims):
    """Service date order, with claim_id as a deterministic tie-break."""
    return sorted(claims, key=lambda claim: (claim["service_date"], claim["claim_id"]))


# ---------------------------------------------------------------- part 1

def adjudicate(plan, claims):
    """Deductible first, then coinsurance on what is left."""
    deductible_left = plan["deductible_cents"]
    rate = Decimal(str(plan["coinsurance_rate"]))

    results = []
    for claim in _ordered(claims):
        billed = claim["billed_cents"]

        to_deductible = min(deductible_left, billed)
        deductible_left -= to_deductible

        after_deductible = billed - to_deductible
        coinsurance = _half_up(Decimal(after_deductible) * rate)

        results.append({
            "claim_id": claim["claim_id"],
            "member_pays_cents": to_deductible + coinsurance,
            "plan_pays_cents": after_deductible - coinsurance,
        })
    return results


# ---------------------------------------------------------------- part 2

def adjudicate_family(plan, claims):
    """Same, but nobody pays past their out-of-pocket maximum."""
    rate = Decimal(str(plan["coinsurance_rate"]))
    deductible_left = {}
    member_paid = {}
    family_paid = 0

    results = []
    for claim in _ordered(claims):
        member = claim["member_id"]
        billed = claim["billed_cents"]
        deductible_left.setdefault(member, plan["deductible_cents"])
        member_paid.setdefault(member, 0)

        to_deductible = min(deductible_left[member], billed)
        after_deductible = billed - to_deductible
        coinsurance = _half_up(Decimal(after_deductible) * rate)
        member_pays = to_deductible + coinsurance

        # The out-of-pocket maximum is a ceiling on what the member has paid all
        # year, so cap the claim by whichever headroom runs out first.
        headroom = min(plan["oop_max_cents"] - member_paid[member],
                       plan["family_oop_max_cents"] - family_paid)
        member_pays = max(0, min(member_pays, headroom))

        # Only what the member actually paid touches the deductible.
        deductible_left[member] -= min(to_deductible, member_pays)
        member_paid[member] += member_pays
        family_paid += member_pays

        results.append({
            "claim_id": claim["claim_id"],
            "member_pays_cents": member_pays,
            "plan_pays_cents": billed - member_pays,
        })
    return results


# ---------------------------------------------------------------- part 3

def reprocess(plan, claims, previous_results):
    """Recompute the year and report what changed since the last run."""
    reversed_ids = {claim["reverses"] for claim in claims
                    if claim.get("type") == "reversal"}

    live = [claim for claim in claims
            if claim.get("type") != "reversal" and claim["claim_id"] not in reversed_ids]

    results = adjudicate_family(plan, live)

    before = {row["claim_id"]: row for row in previous_results}
    after = {row["claim_id"]: row for row in results}

    adjustments = []
    for claim_id in sorted(set(before) | set(after)):
        old = before.get(claim_id, {"member_pays_cents": 0, "plan_pays_cents": 0})
        new = after.get(claim_id, {"member_pays_cents": 0, "plan_pays_cents": 0})
        member_delta = new["member_pays_cents"] - old["member_pays_cents"]
        plan_delta = new["plan_pays_cents"] - old["plan_pays_cents"]
        if member_delta or plan_delta:
            adjustments.append({"claim_id": claim_id,
                                "member_delta_cents": member_delta,
                                "plan_delta_cents": plan_delta})

    return {"results": results, "adjustments": adjustments}
