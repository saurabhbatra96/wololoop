## Part 1 — Arrays and objects

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

Write four functions:

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

<!-- part -->

## Part 2 — Unions and narrowing

A note's history is a list of events, and each kind carries different data:

```ts
type NoteEvent =
  | { kind: "created"; noteId: string; at: string; title: string }
  | { kind: "renamed"; noteId: string; at: string; from: string; to: string }
  | { kind: "shared";  noteId: string; at: string; with: string[] }
  | { kind: "deleted"; noteId: string; at: string };
```

- `describe(event): string` —
  `Created "Standup"`, `Renamed "Standup" to "Daily standup"`,
  `Shared with oat@granola.ai` (one person) or `Shared with 3 people`, and
  `Deleted`. Use a `switch` on `kind`, and end it with the exhaustiveness
  check — `const unreachable: never = event` — so adding a fifth kind is a
  compile error instead of a silent `undefined`.
- `currentTitles(events): Map<string, string>` — replay the events **in `at`
  order** (they arrive shuffled) and return each live note's latest title.
  Deleted notes aren't in the map.
- `parseDuration(input: string | number): number | null` — minutes. A number
  passes through if it's finite and not negative. Strings: `"45"`, `"45m"`,
  `"1h"`, `"1h30m"`, `"1h 30m"` (case-insensitive, spaces around the input are
  fine). Anything else is `null`. Narrow with `typeof` first.

<!-- part -->

## Part 3 — Generics and utility types

Helpers you'd put in a `utils.ts`, typed so callers get precise types back.

```ts
groupBy<T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): Partial<Record<K, T[]>>
pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>
updateMeeting(meeting: Meeting, patch: Partial<Omit<Meeting, "id">>): Meeting
sortBy<T>(items: readonly T[], ...keys: ((item: T) => string | number)[]): T[]
```

- `groupBy` keeps items in their original order within each group. Why
  `Partial`? With `K = "even" | "odd"`, a plain `Record` promises both keys
  exist, and they don't if every number is odd.
- `pick` returns a new object with just those keys; the **type** must know
  which keys it has (the tests check that `pick(m, ["id"]).title` doesn't
  compile).
- `updateMeeting` returns a new meeting and leaves the original alone. The
  patch type makes `id` unpatchable. Keys the patch sets to `undefined` are
  ignored rather than blanking the field.
- `sortBy` sorts a copy by the first key, then the next to break ties, and
  keeps the original order for full ties (JavaScript's sort is stable).

> A likely follow-up: "what's the difference between `interface` and `type`?"
> (Interfaces merge and can be extended; type aliases can name unions,
> tuples and mapped types. For object shapes, either is fine — be consistent.)
