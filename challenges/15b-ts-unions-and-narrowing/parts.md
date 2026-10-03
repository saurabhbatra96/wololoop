## Unions and narrowing

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
