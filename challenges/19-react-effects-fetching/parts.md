## Part 1 — Loading, error, data

The most common React task there is, and the one most often done slightly
wrong: fetch something when a component mounts, and show it.

```tsx
export interface Note { id: string; title: string; summary: string }
export interface NotesApi { getNote(id: string, signal?: AbortSignal): Promise<Note> }

export function NoteDetail({ id, api }: { id: string; api: NotesApi }): JSX.Element
```

- On mount, call `api.getNote(id)` and show `Loading…` until it settles.
- Success: the title in an `<h2>` and the summary in a `<p>`.
- Failure: an element with `role="alert"` reading `Couldn't load note: <message>`
  (use `Unknown error` if what was thrown isn't an `Error`), plus a `Retry`
  button that shows `Loading…` again and re-fetches.

A `useEffect` with `[id, api]` dependencies is the tool. Keep the three
possible screens as one piece of state — for example
`{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; note: Note }`
— rather than separate `loading`/`error`/`note` variables that can disagree.

<!-- part -->

## Part 2 — When the id changes

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

<!-- part -->

## Part 3 — Cancelling and refreshing

Ignoring a stale response still wastes the request. Cancel it, and add
background refresh.

- Create an `AbortController` in the effect and pass its `signal` to
  `api.getNote(id, signal)`. Abort it in the cleanup, so changing `id` or
  unmounting cancels the request in flight. An aborted request rejects; that
  must **not** show the error screen.
- New prop: `refreshMs?: number`. When set, re-fetch every `refreshMs`
  milliseconds **in the background**: keep showing the current note (no
  `Loading…` flash), and swap in the new data when it arrives. A failed
  background refresh keeps the old note on screen.
- Stop the timer on unmount, and restart it when `id` or `refreshMs` changes.
  A forgotten `clearInterval` is the classic leak — the tests unmount and then
  count calls.

> Be ready for: "why not fetch in an event handler instead?" (You should, when
> the fetch is caused by a click — like Retry. Effects are for keeping in
> sync with something external: here, "show whatever note `id` says".) And:
> "what does React Query give you over this?" (Caching, de-duplication, retries,
> refetch on focus — everything you've just half-built.)
