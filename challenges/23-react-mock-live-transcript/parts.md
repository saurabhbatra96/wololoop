## Part 1 — Render a transcript

Another interview-shaped one: 45 minutes, and very close to Granola's core
screen. Talk as you go, and get each part working before you tidy it.

A transcript is a list of lines. `speaker` says whether it's **you** (the
note-taker, `"me"`) or someone else (`"them"`) — the same split Granola's
API uses.

```tsx
export interface TranscriptLine {
  id: string;
  speaker: "me" | "them";
  name?: string;        // who "them" is, when known
  text: string;
  at: string;           // ISO 8601, UTC
}

export function Transcript({ lines }: { lines: TranscriptLine[] }): JSX.Element
```

- Sort by `at` (a copy — lines can arrive out of order).
- **Group consecutive lines by the same speaker** into one `<article>`. Two
  lines count as the same speaker when `speaker` and `name` both match.
- Each group gets an `<h3>` label — `You` for `"me"`, the `name` for
  `"them"`, or `Them` when there's no name — and a
  `<time>` with the first line's time as `HH:MM` in UTC (`09:30`).
- Each line is a `<p>`.
- No lines: `Waiting for someone to speak…`.

> Grouping is derived data: compute it from `lines` during render. Say why
> it isn't state (it would have to be kept in sync with `lines` by hand).

<!-- part -->

## Part 2 — Make it live

Lines now stream in during the meeting.

```tsx
export interface TranscriptSource {
  subscribe(meetingId: string, onLine: (line: TranscriptLine) => void): () => void;  // returns unsubscribe
}

export function LiveTranscript({ meetingId, source }: { meetingId: string; source: TranscriptSource }): JSX.Element
```

- Subscribe on mount and render the lines with your `Transcript`.
  Unsubscribe on unmount.
- A new `meetingId`: unsubscribe from the old one, clear the lines,
  subscribe to the new one. If the old subscription still calls `onLine`
  after that (sources can be sloppy), ignore it.
- The source may **redeliver** a line after a reconnect. Show each `id` once.
- A `Pause` button. While paused, new lines are **held back**, and the button
  reads `Resume (3 new)`. Resume shows them all and goes back to `Pause`. The
  subscription itself stays open while paused.

Watch out for the stale-closure trap: an `onLine` callback created on the
first render sees the first render's state forever. Functional updates
(`setLines(prev => …)`) or a ref avoid it.

<!-- part -->

## Part 3 — Find in transcript

Two tools for skimming a long meeting, both in `LiveTranscript`.

**Search.** An input labelled `Search transcript`:
- Wrap every case-insensitive match inside a line in `<mark>`. Lines without
  a match still show.
- Show the total count: `3 matches`, `1 match`, or nothing when the box is
  empty.
- The query is **text**, not a regular expression: searching for `(ok)` or
  `$5` must work. And don't reach for `dangerouslySetInnerHTML` — split the
  string and render pieces, so a transcript line containing `<b>` stays text.

**Speaker filter.** Three buttons, `Everyone`, `You` and `Them`, with
`aria-pressed` marking the active one (`Everyone` to begin with). Filter the
lines **before** grouping, so two "them" stretches separated by a hidden
"you" line merge into one group.

> Discussion to expect: this rerenders the whole transcript on every
> keystroke and every new line. When would that become a problem, and what
> would you do? (Memoise the grouping with `useMemo`, `React.memo` the group
> component, and for hour-long meetings virtualise the list.)
