## Part 1 — Weekly utilisation

You're building the internal reporting tool for a consultancy. Utilisation —
the share of a consultant's week that's billable to a client — is the number the
partners look at first, so it had better be right.

Timesheet entries look like this:

```python
{
    "entry_id":   "E1",
    "consultant": "amara",
    "project":    "P1",
    "billable":   True,
    "start":      "2026-03-02T09:00:00",
    "end":        "2026-03-02T17:00:00",
}
```

Write:

```python
weekly_utilization(entries) -> dict
```

returning `{(consultant, week_start): utilisation}` where:

- **`week_start`** is the Monday of that week, as `"YYYY-MM-DD"`. A Sunday entry
  belongs to the week that started six days earlier, not the one starting
  tomorrow.
- **utilisation** is `billable_hours / 40.0`, rounded with `round(x, 3)`.
- Non-billable time still puts the consultant in the report — at 0.0 if that's
  all they did. Bench time is exactly what the partners want to see.

```python
# one 09:00-17:00 billable day
{('amara', '2026-03-02'): 0.2}
```

<!-- part -->

## Part 2 — Double bookings

Finance is rejecting invoices. Two consultants have been billing the same hour
to two different clients, and one of them logged 31 hours on a Tuesday.

```python
find_conflicts(entries) -> list[tuple[str, str]]
```

Return every pair of entry ids for **the same consultant** whose time ranges
overlap. Pairs sorted internally, the list sorted, each pair reported once.

- Touching endpoints are **not** an overlap — a booking ending at 12:00 and one
  starting at 12:00 is a normal day.
- One entry fully inside another is an overlap.
- Three entries covering the same hour produce **three** pairs, not one.
- Different consultants never conflict with each other.
- The feed is not sorted.

> The obvious answer compares every entry with every other one. It's correct,
> and for a 20-person practice it's fine. The follow-up is always "we have 4,000
> consultants and five years of timesheets" — so sort by start time and stop
> comparing as soon as an entry starts after the current one ends.

<!-- part -->

## Part 3 — Staffing the bench

Now the thing the partners actually asked for: given open client requests and
who's available, staff them.

```python
consultants = {
    "amara": {"skills": ["data", "strategy"], "max_concurrent": 2},
    "bo":    {"skills": ["data"],             "max_concurrent": 1},
}

requests = [{"request_id": "R1", "skill": "data",
             "start": "2026-04-06", "end": "2026-04-17"}]

assign(consultants, requests) -> dict
```

Return `{"assignments": {request_id: consultant}, "unassigned": [request_id, ...]}`
with `unassigned` sorted.

The rules, in this order:

1. Work through requests **earliest `start` first**, ties broken by
   `request_id`. The order they happen to sit in the list means nothing.
2. A consultant is eligible if they have the required `skill` **and** taking
   this request would leave them with no more than `max_concurrent` engagements
   overlapping it. Intervals are half-open: an engagement ending on the 10th
   doesn't collide with one starting on the 10th.
3. Among eligible consultants pick the one with the **fewest engagements so
   far**, breaking ties on name, A→Z.
4. Nobody eligible? The request goes to `unassigned` and you move on — one
   impossible request must not stall the ones behind it.

> This greedy is not optimal, and you should say so before anyone asks. Staffing
> the earliest request first can burn the only consultant who could have covered
> a later, pickier one. Optimal assignment here is bipartite matching; the
> greedy is what a partner can understand and override, which is usually what
> ships. Have both answers ready.
