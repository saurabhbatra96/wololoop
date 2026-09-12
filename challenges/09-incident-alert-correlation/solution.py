"""Reference solution - 09 Incident Alert Correlation.

Part 2 is the interesting one. A single threshold on a noisy signal produces an
alert that fires, clears, fires and clears again - the pager equivalent of a
car alarm, and the reason on-call engineers start ignoring pages. Two
thresholds (enter high, leave low) give the state machine somewhere to sit.
"""

import datetime


def _minute(ts):
    return ts[:16]


def _minute_range(minutes):
    """Every minute between the first and last seen, including silent ones."""
    if not minutes:
        return []
    start = datetime.datetime.fromisoformat(min(minutes))
    end = datetime.datetime.fromisoformat(max(minutes))
    out = []
    while start <= end:
        out.append(start.isoformat(timespec="minutes"))
        start += datetime.timedelta(minutes=1)
    return out


# ---------------------------------------------------------------- part 1

def error_rates(events):
    """{(service, minute): errors / total}, rounded to 3dp."""
    totals = {}
    errors = {}
    for event in events:
        key = (event["service"], _minute(event["ts"]))
        totals[key] = totals.get(key, 0) + 1
        if event["level"] == "error":
            errors[key] = errors.get(key, 0) + 1
    return {key: round(errors.get(key, 0) / count, 3) for key, count in totals.items()}


# ---------------------------------------------------------------- part 2

def detect_alerts(events, window_minutes, enter, leave):
    """Rolling-window error rate with hysteresis, as alert intervals."""
    totals = {}
    errors = {}
    for event in events:
        key = (event["service"], _minute(event["ts"]))
        totals[key] = totals.get(key, 0) + 1
        if event["level"] == "error":
            errors[key] = errors.get(key, 0) + 1

    timeline = _minute_range({minute for _service, minute in totals})
    services = sorted({service for service, _minute_key in totals})

    alerts = []
    for service in services:
        alerting = False
        current = None
        for index, minute in enumerate(timeline):
            window = timeline[max(0, index - window_minutes + 1):index + 1]
            seen = sum(totals.get((service, m), 0) for m in window)
            bad = sum(errors.get((service, m), 0) for m in window)
            rate = (bad / seen) if seen else 0.0

            if not alerting and rate >= enter:
                alerting = True
                current = {"service": service, "start": minute, "end": None}
            elif alerting and rate <= leave:
                alerting = False
                current["end"] = minute
                alerts.append(current)
                current = None
        if current is not None:
            alerts.append(current)       # still firing when the data runs out

    return sorted(alerts, key=lambda alert: (alert["service"], alert["start"]))


# ---------------------------------------------------------------- part 3

def correlate(alerts, dependencies):
    """Group alerting services into incidents and name a likely root cause."""
    alerting = {alert["service"] for alert in alerts}

    # Only edges between two alerting services matter: a healthy service does
    # not join two unrelated incidents together.
    neighbours = {service: set() for service in alerting}
    for service in alerting:
        for target in dependencies.get(service, []):
            if target in alerting:
                neighbours[service].add(target)
                neighbours[target].add(service)

    seen = set()
    incidents = []
    for service in sorted(alerting):
        if service in seen:
            continue
        component = []
        queue = [service]
        seen.add(service)
        while queue:                                  # plain BFS
            node = queue.pop()
            component.append(node)
            for other in sorted(neighbours[node]):
                if other not in seen:
                    seen.add(other)
                    queue.append(other)

        # The root cause is the one nothing below it is also broken - i.e. a
        # service with no alerting dependency. A cycle has no such service, so
        # fall back to the whole component.
        deepest = [s for s in component
                   if not any(d in alerting for d in dependencies.get(s, []))]
        incidents.append({"services": sorted(component),
                          "root_cause": sorted(deepest or component)[0]})

    return sorted(incidents, key=lambda incident: incident["services"][0])
