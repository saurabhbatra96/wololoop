## Part 1 — Render a list

A warm-up to get your hands used to JSX again. Granola's sidebar lists your
meetings; build that list.

```tsx
export interface Meeting {
  id: string;
  title: string;
  startsAt: string;      // ISO 8601, e.g. "2026-10-01T09:30:00Z"
  attendees: string[];   // emails
  hasNotes: boolean;
}

export function MeetingList({ meetings }: { meetings: Meeting[] }): JSX.Element
```

- Render a `<ul>` with one `<li>` per meeting, **earliest first**. Sort a
  copy — props are read-only, and `meetings.sort()` sorts the caller's array in
  place. (The tests hand you a frozen array, so that would throw.)
- Each item shows the **title**, and the attendee count as `"3 attendees"` or
  `"1 attendee"` in its own element.
- Show a `Notes` badge **only** when `hasNotes` is true.
- No meetings → render `<p>No meetings yet</p>` instead of an empty list.
- Every `<li>` needs a stable `key`. Use the id, not the array index: an
  index key makes React reuse the wrong DOM (and the wrong state) when the list
  is re-sorted. The tests listen for React's missing-key warning.

The tests find things the way a user would — by text and by role (`listitem`,
`button`, `heading`) — so plain semantic HTML is what passes. That's also how
Testing Library works, if the interviewer asks how you'd test this.

<!-- part -->

## Part 2 — Selecting a meeting

Now a two-pane layout: the list on the left, the selected meeting on the right.

```tsx
export function MeetingList(props: {
  meetings: Meeting[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}): JSX.Element

export default function App({ meetings }: { meetings: Meeting[] }): JSX.Element
```

- In `MeetingList`, each title becomes a `<button>` that calls `onSelect(id)`.
  The selected meeting's `<li>` gets `aria-current="true"`.
- `App` owns the selection (lifting state up: the list reports clicks, the
  parent decides). Before anything is selected, the right pane says
  `Select a meeting`.
- Once selected, the right pane shows the title as an `<h2>` and each attendee
  in a list.
- Store the selected **id**, not the meeting object. If the parent passes
  fresh data (the title was renamed), the detail pane must show the new title.
  If the selected meeting disappears, go back to `Select a meeting`.

> Why the id? A copied object is a second source of truth that goes stale the
> moment props change. Keep the minimum in state and **derive** the rest while
> rendering.

<!-- part -->

## Part 3 — Filtering without extra state

Add a search box above the list in `App`:

- An `<input>` with a `<label>` reading `Search`.
- Filter by title **or** attendee email, case-insensitive, ignoring
  surrounding spaces.
- Below the box, show `Showing 2 of 5`.
- Nothing matches → `No meetings match "xyz"` (with the query as typed,
  trimmed) instead of the list.
- The selection survives filtering: if the selected meeting is filtered out
  of the list, the right pane still shows it.

The rule of this part: the filtered list is **not** state. It's computed from
`meetings` and `query` on every render. A `useState` + `useEffect` pair that
copies filtered results into state will lag a render behind and go stale when
props change — the tests change props with a query typed in.

> Interviewers love asking "when would you reach for `useMemo` here?" Honest
> answer: not until filtering is measurably slow. A few hundred meetings is
> microseconds.
