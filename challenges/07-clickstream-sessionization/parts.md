## Part 1 — Split into sessions

You're on the analytics platform team. Raw clickstream comes in as one row per
page view; every question the growth team asks is really about **sessions**, and
right now nobody can agree on what a session is because nobody has implemented
one.

```python
{"event_id": "e1", "user_id": "u1", "ts": "2026-05-01T10:00:00", "page": "/home"}
```

Write:

```python
sessionize(events, gap_seconds=1800) -> dict
```

returning `{user_id: [[event_id, ...], ...]}` — one inner list per session, in
chronological order, with the event ids inside each session in chronological
order too.

- A new session starts when the gap since that user's **previous event** is
  **at least** `gap_seconds`. Exactly 30 minutes counts as inactive.
- The gap is measured from the last event, not from the start of the session. A
  two-hour visit with a click every 25 minutes is one session.
- Users are independent.
- **Events do not arrive in timestamp order.** They come off a queue with
  several partitions, so sort before you do anything else.

```python
sessionize(events)
{'u1': [['e1', 'e2'], ['e3']], 'u2': [['e4', 'e5', 'e6']]}
```

<!-- part -->

## Part 2 — Funnel conversion

Growth wants the classic report: of everyone who landed on `/home`, how many
reached `/pricing`, and of those, how many reached `/checkout`?

```python
funnel_counts(events, steps, gap_seconds=1800) -> list[int]
```

`steps` is an ordered list of pages. Return a list the same length, where
`counts[i]` is the number of **sessions** that reached step `i` — meaning they
hit every step up to and including it, **in order**.

- Steps do **not** have to be consecutive. Wandering through `/blog` between
  `/home` and `/pricing` is still a conversion.
- Order matters. Hitting `/checkout` before `/pricing` doesn't count — they
  have to come back through pricing afterwards for the funnel to complete.
- A session that never hits step 1 counts nowhere, even if it visits every
  later step.
- Counting is **per session**, not per user. One person visiting twice is two
  entries at the top of the funnel.
- Repeating a step doesn't advance the funnel twice.

```python
funnel_counts(events, ["/home", "/pricing", "/checkout"])
[1200, 340, 96]
```

<!-- part -->

## Part 3 — Top pages by reach

The content team wants to know which pages matter. They do **not** want
pageviews — a single user refreshing a dashboard for an hour would win.

```python
top_pages_by_reach(events, n, gap_seconds=1800) -> list[tuple[str, int]]
```

**Reach** is the number of distinct sessions that touched a page at least once.
Three views of `/home` in one session is reach 1 for that page. The same page in
two sessions is reach 2.

Return the top `n` as `(page, reach)`, highest first, ties broken by page path
**ascending**. `n` larger than the catalogue returns everything; `n = 0` returns
`[]`.

> Two things worth saying about this one. First: ranking by sorting every page
> is `O(p log p)` when you only want `n` of them — `heapq.nlargest` keeps the
> work at `O(p log n)`. Second, and more interesting: this is still exact, which
> means holding a counter for **every** page. At a few million distinct URLs
> that stops being free, and the real answer becomes a count-min sketch or a
> space-saving summary — approximate counts, bounded memory. Knowing when you're
> allowed to be approximate is the senior half of the question.
