## Part 1 — Error rate per minute

You're building the alerting pipeline for an on-call rotation that's currently
drowning. Everything starts from a stream of log events:

```python
{"ts": "2026-07-01T10:00:31", "service": "api", "level": "error"}
```

`level` is `"info"`, `"warn"` or `"error"`.

```python
error_rates(events) -> dict
```

Return `{(service, minute): error_rate}` where `minute` is the timestamp
truncated to `"YYYY-MM-DDTHH:MM"` and the rate is `errors / total_events` in
that minute, rounded with `round(x, 3)`.

- `warn` is traffic, not failure: it counts in the denominator only.
- A minute with no errors still appears, at `0.0`. Healthy minutes are data.
- Services are independent.

```python
{('api', '2026-07-01T10:00'): 0.2, ('api', '2026-07-01T10:01'): 0.9}
```

<!-- part -->

## Part 2 — Burst detection without flapping

Now turn rates into pages. The naive version — "page when the rate goes over
50%" — is what we have today, and it's why nobody reads the alerts: a service
sitting near the threshold fires, clears, fires and clears, six times an hour.

```python
detect_alerts(events, window_minutes, enter, leave) -> list[dict]
```

Return alert intervals:

```python
[{"service": "api", "start": "2026-07-01T10:01", "end": "2026-07-01T10:04"}]
```

The rules:

- Evaluate every minute from the first to the last minute **anywhere in the
  data** — including minutes where a service logged nothing.
- At each minute, compute the error rate over the trailing `window_minutes`
  minutes, inclusive of the current one.
- **Two thresholds.** Not alerting and rate `>= enter` → the alert opens at this
  minute. Alerting and rate `<= leave` → it closes at this minute. In between,
  nothing changes. That gap is the hysteresis, and it's the entire point: the
  state machine has somewhere to sit while the signal wobbles.
- A window with no events at all has a rate of `0.0`.
- An alert still firing when the data runs out has `"end": None`. Don't invent a
  recovery you didn't observe.
- Sorted by service, then start.

<!-- part -->

## Part 3 — From alerts to incidents

Last night's outage paged four people for one problem. The database got slow,
so the api timed out, so the web tier threw 500s, so the worker backed up. Four
alerts. One incident. One thing to fix.

```python
dependencies = {"web": ["api"], "api": ["db"], "db": [], "worker": ["db"]}

correlate(alerts, dependencies) -> list[dict]
```

`dependencies[x]` lists what `x` **depends on**. Return:

```python
[{"services": ["api", "db", "web", "worker"], "root_cause": "db"}]
```

- Group alerting services into **connected components**, following dependency
  edges in either direction — but **only between two services that are both
  alerting**. A healthy service in the middle does not join two unrelated
  incidents together; that's the difference between correlation and one giant
  useless page.
- The **root cause** is the alerting service that has no alerting dependency —
  the deepest broken thing, the one whose failure explains the others.
- Several candidates? Take the alphabetically first, so the output is stable.
- A dependency **cycle** has no deepest service. Fall back to the
  alphabetically first service in the component rather than looping forever.
- A service missing from `dependencies` simply has none.
- Duplicate alerts for one service collapse. Components sorted by their first
  service; services within a component sorted.

> Worth naming out loud: this is a heuristic, not a diagnosis. If two unrelated
> things break at once inside one dependency chain, you'll merge them and point
> at the wrong root. Real systems soften that with a time window — alerts have
> to start close together to correlate — and even then, on-call gets a list of
> candidates, not a verdict.
