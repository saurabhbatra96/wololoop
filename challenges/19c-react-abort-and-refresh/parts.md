## Cancelling and refreshing

The starter has the race-safe `NoteDetail` from the previous problem, with `refreshMs` already in its props; the `TODO`s mark what's new.

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
