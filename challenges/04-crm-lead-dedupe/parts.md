## Part 1 — Normalise and group

Sales ops has a problem you've heard before: the same human being is in the CRM
four times. Once from a webform, once from a conference badge scan, twice from a
CSV somebody imported in 2023. Every report is wrong and nobody trusts the
pipeline number.

A lead looks like this:

```python
{
    "lead_id":    "L1",
    "name":       "Dana Reed",
    "email":      "Dana.Reed+crm@example.com",
    "phone":      "+1 (415) 555-0142",
    "company":    "Acme",
    "source":     "webform",
    "updated_at": "2026-06-01T09:14:00",
}
```

Nothing can be compared until it's canonical, so start there.

```python
normalize_email(raw) -> str | None
normalize_phone(raw) -> str | None
group_by_email(leads) -> dict
```

**Email.** Trim, lowercase. Drop any `+tag` from the local part — it's the same
mailbox. For `gmail.com` and `googlemail.com`, also strip dots from the local
part and treat both as `gmail.com`, because Google does. Do **not** strip dots
for other providers; `d.a.n.a@example.com` is a different mailbox from
`dana@example.com`. Anything blank or without an `@` has no canonical form —
return `None`.

**Phone.** Keep digits only. A leading country code `1` on an 11-digit number
comes off. What's left must be exactly 10 digits, otherwise `None` — we're
US-only for now and a 4-digit extension is not an identifier.

**Group.** `group_by_email` returns `{canonical_email: [lead_id, ...]}` in input
order, skipping leads with no usable address.

<!-- part -->

## Part 2 — Transitive clusters

Email alone isn't enough. Half the badge-scan rows have a phone and no email,
and the CSV import has the reverse.

```python
cluster_leads(leads) -> list[list[str]]
```

Two leads belong together if they share a canonical **email** *or* a canonical
**phone**. The catch, and the whole point of this part: that relationship is
**transitive**.

```
L1  email dana@x.com
L2  email dana@x.com   phone 415-555-0142
L3                     phone 4155550142
```

L1 and L3 have nothing in common, but both match L2, so all three are one
person. Chains can be arbitrarily long and the input is in no useful order.

Return every lead exactly once. A lead with no usable identifier is a cluster of
one. Members sorted, clusters sorted by their first member, so the output is
deterministic.

> The data structure this is asking for is **union-find** (disjoint set). You
> can do it with sets-of-sets and merging, and it'll pass, but be ready to
> explain why that's quadratic in the bad case and union-find isn't.

<!-- part -->

## Part 3 — Golden records

Clustering tells you who is duplicated. It doesn't tell you what their phone
number *is*. Four rows disagree, and someone has to pick.

```python
golden_records(leads, source_priority) -> list[dict]
```

One record per cluster, in cluster order:

```python
{
    "lead_ids":   ["L1", "L3"],
    "name":       "Dana Reed",
    "email":      "dana@example.com",
    "phone":      "4155550142",
    "company":    "Acme",
    "provenance": {"name": "L1", "email": "L1", "phone": "L3", "company": "L3"},
}
```

Each field is chosen **independently** — the golden record is assembled, not
copied from a single winning lead. For each of `name`, `email`, `phone`,
`company`, among the leads in the cluster that have a non-blank value:

1. Highest **source priority** wins. `source_priority` is a list, most trusted
   first; a source not in that list ranks below every source that is.
2. Ties break on **most recent `updated_at`**.
3. Still tied? Lowest `lead_id`, so the output never depends on dict ordering.

A blank or whitespace-only value never wins, no matter how trusted its source —
a pristine Salesforce row with an empty company must not erase a good one.
Store `email` and `phone` in their **canonical** form. A field nobody has is
`None`, with no entry in `provenance`.

> `provenance` is not decoration. The first question after you ship this is
> "why does Dana have the wrong phone number?", and without it the only answer
> is a re-run of the whole pipeline.
