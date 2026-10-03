## When the id changes

The starter has a working `NoteDetail` from the previous problem. It has a bug when `id` changes; the `TODO` marks where the fix goes.

The parent now swaps `id` as the user clicks around the sidebar.

- A new `id` shows `Loading…` right away — never the previous note under the
  new id — and fetches the new note.
- **Race condition:** click note A (slow server), then note B (fast). B
  arrives, then A arrives late. The screen must end on **B**. A late *error*
  from A must not show up either.

The standard fix: the effect's cleanup sets a local `ignore = true` (or
`cancelled`), and the `.then` checks it before setting state. Each run of the
effect gets its own flag, closed over. This is straight from the React docs,
so it's what an interviewer will expect you to know.
