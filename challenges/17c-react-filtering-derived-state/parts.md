## Filtering without extra state

The starter has the list and the selection working; the `TODO`s in `App` mark what's new.

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
