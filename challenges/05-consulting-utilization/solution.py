"""Reference solution - 05 Consulting Utilisation and Staffing.

Three flavours of interval work in one problem: bucketing by week, detecting
overlap with a sweep, and a constrained greedy assignment. The thing tying them
together is that every rule is stated explicitly - when a spec says "fewest
assignments, then alphabetically", that is not pedantry, it is the difference
between a deterministic system and one that reshuffles staffing every deploy.
"""

import datetime

STANDARD_WEEK_HOURS = 40.0


# ---------------------------------------------------------------- part 1

def _week_start(iso_datetime):
    """Monday of the week containing this timestamp, as YYYY-MM-DD."""
    moment = datetime.datetime.fromisoformat(iso_datetime)
    monday = moment.date() - datetime.timedelta(days=moment.weekday())
    return monday.isoformat()


def _hours(entry):
    start = datetime.datetime.fromisoformat(entry["start"])
    end = datetime.datetime.fromisoformat(entry["end"])
    return (end - start).total_seconds() / 3600.0


def weekly_utilization(entries):
    """{(consultant, week_start): billable_hours / 40, rounded to 3dp}."""
    billable = {}
    weeks = set()
    for entry in entries:
        key = (entry["consultant"], _week_start(entry["start"]))
        weeks.add(key)
        if entry.get("billable"):
            billable[key] = billable.get(key, 0.0) + _hours(entry)
    return {key: round(billable.get(key, 0.0) / STANDARD_WEEK_HOURS, 3) for key in weeks}


# ---------------------------------------------------------------- part 2

def find_conflicts(entries):
    """Pairs of entry ids that overlap in time for the same consultant."""
    by_consultant = {}
    for entry in entries:
        by_consultant.setdefault(entry["consultant"], []).append(entry)

    conflicts = []
    for bookings in by_consultant.values():
        # Sort by start, then sweep: an entry can only collide with ones that
        # are still open, so we stop comparing as soon as a start clears the
        # furthest end we have seen.
        bookings = sorted(bookings, key=lambda e: (e["start"], e["entry_id"]))
        for index, entry in enumerate(bookings):
            start = datetime.datetime.fromisoformat(entry["start"])
            for other in bookings[index + 1:]:
                if datetime.datetime.fromisoformat(other["start"]) >= \
                        datetime.datetime.fromisoformat(entry["end"]):
                    break
                conflicts.append(tuple(sorted((entry["entry_id"], other["entry_id"]))))
    return sorted(set(conflicts))


# ---------------------------------------------------------------- part 3

def _overlaps(a_start, a_end, b_start, b_end):
    """Half-open intervals: touching at an endpoint is not an overlap."""
    return a_start < b_end and b_start < a_end


def assign(consultants, requests):
    """Greedy staffing. Earliest request first, least-loaded eligible consultant."""
    booked = {name: [] for name in consultants}      # name -> [(start, end)]
    load = {name: 0 for name in consultants}
    assignments = {}
    unassigned = []

    for request in sorted(requests, key=lambda r: (r["start"], r["request_id"])):
        start, end = request["start"], request["end"]

        eligible = []
        for name, profile in consultants.items():
            if request["skill"] not in profile["skills"]:
                continue
            concurrent = sum(1 for s, e in booked[name] if _overlaps(start, end, s, e))
            if concurrent >= profile["max_concurrent"]:
                continue
            eligible.append(name)

        if not eligible:
            unassigned.append(request["request_id"])
            continue

        chosen = min(eligible, key=lambda name: (load[name], name))
        assignments[request["request_id"]] = chosen
        booked[chosen].append((start, end))
        load[chosen] += 1

    return {"assignments": assignments, "unassigned": sorted(unassigned)}
