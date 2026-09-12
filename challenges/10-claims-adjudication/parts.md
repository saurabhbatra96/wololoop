## Part 1 — Deductible and coinsurance

You're on the claims platform at a health insurer. When a claim comes in,
something has to decide who pays what. That decision is **adjudication**, and
getting it wrong is both a support nightmare and a regulatory problem.

```python
PLAN = {"deductible_cents": 50000, "coinsurance_rate": "0.20",
        "oop_max_cents": 80000, "family_oop_max_cents": 120000}

{"claim_id": "C1", "member_id": "m1",
 "service_date": "2026-01-10", "billed_cents": 100000}
```

```python
adjudicate(plan, claims) -> list[dict]
# [{"claim_id": "C1", "member_pays_cents": 60000, "plan_pays_cents": 40000}]
```

For each claim, in order:

1. **Deductible first.** The member pays out of pocket until their deductible
   for the year is used up. That's the first `deductible_cents` of billed
   charges, spread across however many claims it takes.
2. **Coinsurance on the rest.** Of whatever remains on that claim, the member
   pays `coinsurance_rate` and the plan pays the rest. Round the member's share
   **half up** to the cent — `round()` won't do, it rounds half to even.
3. Claims are processed in **`service_date`** order, ties broken by `claim_id`.
   The order they arrive in is not the order they happened in.

`member_pays_cents + plan_pays_cents` must equal `billed_cents` on every claim.
Not one cent may go missing — this is the invariant the whole system rests on.

<!-- part -->

## Part 2 — Out-of-pocket maximums

The part that actually protects people: however bad the year gets, there's a
ceiling on what a member pays.

```python
adjudicate_family(plan, claims) -> list[dict]
```

Same shape, two new rules stacked on top:

- **Individual cap.** Once a member's total `member_pays_cents` for the year
  reaches `oop_max_cents`, they pay nothing further. The plan picks up 100%.
- **Family cap.** Once *everyone's* payments together reach
  `family_oop_max_cents`, every member is covered at 100%, even one who never
  came close to their own cap.
- The claim that **crosses** a cap is split: the member pays only up to the
  ceiling, and the plan absorbs the remainder of what would have been their
  share.
- Each member has their **own** deductible.
- Nobody ever pays a negative amount.

One subtlety worth getting right: **only money the member actually paid counts
toward their deductible.** If a cap reduced their payment on a claim, they get
deductible credit for what they paid, not for what they were originally
charged.

```python
# m1 caps out at 80000, then the family cap stops m2 partway through C4
[("C1", 60000, 40000), ("C2", 20000, 80000), ("C3", 0, 50000),
 ("C4", 40000, 60000), ("C5", 0, 50000)]
```

<!-- part -->

## Part 3 — Late claims and reversals

Here's what makes claims genuinely hard. A provider can bill six weeks late. A
claim adjudicated in March can turn out to have happened *before* one you
already paid in February — and because accumulators are cumulative, the late
claim changes the answer for claims that are already settled.

```python
reprocess(plan, claims, previous_results) -> dict
# {"results": [...], "adjustments": [...]}
```

- `claims` may contain **reversal** records: `{"claim_id": "R1",
  "type": "reversal", "reverses": "C1"}`. The reversed claim is removed from the
  year entirely, and the reversal record is not itself a claim. Reversing
  something that was never there is harmless.
- Re-adjudicate the surviving claims **from scratch** in service-date order.
- Then diff against `previous_results` and emit an **adjustment** for every
  claim whose numbers moved:

```python
{"claim_id": "C3", "member_delta_cents": -10000, "plan_delta_cents": 10000}
```

  A claim that has vanished diffs against zero. Claims that didn't move produce
  no adjustment. Sorted by `claim_id`.
- Feeding the output straight back in must produce **no** adjustments.

> Resist the urge to patch the accumulators in place — "C2 arrived, add 20000 to
> the year-to-date, move on". It looks cheaper and it's how claims systems end
> up unable to explain their own numbers. Recompute the year and emit the
> difference: the full state is always derivable from the claim log, and every
> correction is an auditable delta rather than a mutation nobody can trace.
