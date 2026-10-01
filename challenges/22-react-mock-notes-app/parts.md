## Part 1 — Notes and a detail pane

This one is shaped like the real interview: 45 minutes, TypeScript and a bit
of React, the kind of screen Granola builds every day. Treat it that way —
talk while you work, ask about anything ambiguous, and **get something working
before you polish**. The parts are sized so a working Part 1 in 15 minutes is
on pace.

You're building the notes screen: a list of meeting notes, and the selected
note's summary beside it. The API is given (in the starter) and injected as a
prop, so the tests can play the server:

```tsx
interface NotesApi {
  listNotes(params: { cursor?: string; query?: string }): Promise<NotesPage>;
  getNote(id: string): Promise<Note>;
  renameNote(id: string, title: string): Promise<NoteSummary>;   // Part 3
}

export default function NotesApp({ api }: { api: NotesApi }): JSX.Element
```

- On mount, load the first page with `api.listNotes({})`. Show
  `Loading notes…` meanwhile.
- Each note is a `<button>` with its title. No notes: `No notes yet`.
- Failure: `role="alert"` with `Couldn't load notes`, and a `Retry` button.
- Clicking a note loads it with `api.getNote(id)` — `Loading note…`
  meanwhile — then shows its title in an `<h2>` and its `summary` in a `<p>`.
  Before anything is clicked, show `Select a note`.
- Click one note and then another before the first arrives: the screen must
  end on the **last one clicked**.

<!-- part -->

## Part 2 — More notes, and search

The API returns 20 notes a page, and people have hundreds.

**Pagination.** When the last page came back with a `nextCursor`, show a
`Load more` button. It calls `api.listNotes({ cursor })` and **appends** the
page. While it's loading, the button reads `Loading…` and is disabled. No
`nextCursor`, no button.

**Search.** Add an input labelled `Search notes`. Search runs on the server:

- Wait for a **300 ms** pause in typing, then call
  `api.listNotes({ query })` with the trimmed query and **replace** the list.
  Clearing the box goes back to the unfiltered list.
- `Load more` while searching passes both: `{ cursor, query }`.
- Responses can arrive out of order. If `"ro"`'s results land after
  `"roadmap"`'s, ignore them — the list must match what's in the box.
- No results for a query: `No notes match "roadmap"`.
- The open note stays open while you search.

<!-- part -->

## Part 3 — Rename, optimistically

Renaming should feel instant.

- In the detail pane, a `Rename` button opens a small form: an input labelled
  `Title`, filled with the current title, and a `Save` button (disabled while
  the title is blank).
- On Save, **immediately** show the new title everywhere — the list button
  and the `<h2>` — and close the form. Then call `api.renameNote(id, title)`.
- When the server answers, use the title **it** returns (it might tidy it up).
- If it fails, **put the old title back** in both places and show
  `role="alert"`: `Couldn't rename note`.

> This is the follow-up conversation to prepare for. Where does the note's
> title "live" now — the list, the detail, or both? (Ideally one place, so a
> rename can't update one and miss the other.) What if two renames of the same
> note overlap and the first fails? And how would React Query's `onMutate` /
> rollback pattern replace what you've just written?
