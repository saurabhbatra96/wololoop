## Arrays and objects

Fingers first. No React yet — just the everyday TypeScript that fills the
gaps between components: reshaping arrays of data without mutating them.

```ts
interface Meeting {
  id: string;
  title: string;
  start: string;           // ISO 8601 in UTC, e.g. "2026-10-01T09:30:00Z"
  durationMinutes: number;
  owner: string;           // email
  attendees: string[];     // emails, any case
}
```

Fill in the four functions in the starter:

- `upcoming(meetings, now: string): Meeting[]` — meetings starting at or
  after `now`, earliest first, ties broken by title A→Z. Don't touch the
  input array (the tests freeze it).
- `minutesByOwner(meetings): Record<string, number>` — total minutes per owner.
- `uniqueAttendees(meetings): string[]` — every attendee once, lower-cased,
  sorted A→Z. (A `Set` is the tool.)
- `busiestDay(meetings): string | null` — the UTC day (`"2026-10-01"`) with the
  most total minutes; on a tie, the earlier day; no meetings, `null`.

ISO timestamps in the same format sort correctly as strings, so
`a.start.localeCompare(b.start)` is fine. Say so out loud if you rely on it —
it's the kind of assumption interviewers like to hear named.
