# 10 - Health Claims Adjudication
#
# All money is integer cents.

PLAN = {"deductible_cents": 50000, "coinsurance_rate": "0.20",
        "oop_max_cents": 80000, "family_oop_max_cents": 120000}

CLAIMS = [
    {"claim_id": "C1", "member_id": "m1", "service_date": "2026-01-10",
     "billed_cents": 100000},
]


def adjudicate(plan, claims):
    """[{"claim_id", "member_pays_cents", "plan_pays_cents"}, ...]"""
    raise NotImplementedError("adjudicate")


if __name__ == "__main__":
    print(adjudicate(PLAN, CLAIMS))
