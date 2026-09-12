"""Reference solution - 07 Clickstream Sessionisation.

The whole problem is one idea applied three times: sort once, then walk the
sequence keeping only the state you need. Sessionising is a gap scan, funnel
matching is a two-pointer, and reach is a set per session. None of it needs the
events in memory twice.
"""

import datetime
import heapq

DEFAULT_GAP = 1800


def _moment(event):
    return datetime.datetime.fromisoformat(event["ts"])


# ---------------------------------------------------------------- part 1

def sessionize(events, gap_seconds=DEFAULT_GAP):
    """{user_id: [[event_id, ...], ...]} - sessions split on inactivity."""
    by_user = {}
    for event in sorted(events, key=lambda e: (e["ts"], e["event_id"])):
        by_user.setdefault(event["user_id"], []).append(event)

    sessions = {}
    for user, user_events in by_user.items():
        runs = []
        previous = None
        for event in user_events:
            if previous is None or (_moment(event) - previous).total_seconds() >= gap_seconds:
                runs.append([])
            runs[-1].append(event["event_id"])
            previous = _moment(event)
        sessions[user] = runs
    return sessions


def _sessions_as_events(events, gap_seconds):
    """Same split as sessionize, but yielding the events themselves."""
    by_id = {event["event_id"]: event for event in events}
    for user, runs in sessionize(events, gap_seconds).items():
        for run in runs:
            yield user, [by_id[event_id] for event_id in run]


# ---------------------------------------------------------------- part 2

def funnel_counts(events, steps, gap_seconds=DEFAULT_GAP):
    """How many sessions reached each step, in order."""
    counts = [0] * len(steps)
    if not steps:
        return counts

    for _user, session in _sessions_as_events(events, gap_seconds):
        reached = 0
        for event in session:                      # two pointers: events x steps
            if reached < len(steps) and event["page"] == steps[reached]:
                reached += 1
        for index in range(reached):
            counts[index] += 1
    return counts


# ---------------------------------------------------------------- part 3

def top_pages_by_reach(events, n, gap_seconds=DEFAULT_GAP):
    """Top n pages by how many distinct sessions touched them."""
    if n <= 0:
        return []

    reach = {}
    for _user, session in _sessions_as_events(events, gap_seconds):
        for page in {event["page"] for event in session}:
            reach[page] = reach.get(page, 0) + 1

    # nlargest keeps the heap at size n instead of sorting every page, and it
    # is tie-stable, so pre-sorting by page name makes equal counts come back
    # alphabetically without any reverse-comparing wrapper.
    ranked = sorted(reach.items())
    return heapq.nlargest(n, ranked, key=lambda item: item[1])
