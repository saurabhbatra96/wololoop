## Loading, error, data

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
