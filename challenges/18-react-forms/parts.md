## Part 1 — A controlled form

A form to create a note: a title and a body.

```tsx
export interface NoteDraft { title: string; body: string }

export function NoteForm({ onSubmit }: { onSubmit: (draft: NoteDraft) => void }): JSX.Element
```

- A text `<input>` labelled `Title` and a `<textarea>` labelled `Body`, both
  **controlled**: their value lives in React state. Connect each label with
  `htmlFor`/`id` or by wrapping the input — the tests find fields by label.
- A submit button, `Save`.
- Under the title, a counter: `0 / 80`, counting the title as typed.
- `Save` is disabled while the title is blank (spaces don't count) or longer
  than 80 characters. Over 80, also show `Title is too long`.
- Use a real `<form onSubmit>`, so pressing **Enter** in the title submits too.
  Call `event.preventDefault()` — without it the browser reloads the page.
- On submit, call `onSubmit` with the title **trimmed** and the body as typed,
  then clear both fields.

> Controlled vs uncontrolled is a classic question. Controlled: React state is
> the source of truth, so you can validate on every keystroke (you need that
> here). Uncontrolled (`defaultValue` + a ref or `FormData`): less code when
> you only read values on submit.

<!-- part -->

## Part 2 — Saving is async

Saving talks to a server, so `onSubmit` now returns a promise:

```tsx
onSubmit: (draft: NoteDraft) => Promise<void>
```

- While saving: the button reads `Saving…` and is disabled, and a second
  click or Enter must not submit again.
- Success: clear the form and show `Saved`. The `Saved` message goes away as
  soon as the user types again.
- Failure: **keep what they typed**, re-enable the button, and show the
  error's message in an element with `role="alert"`. If the thing thrown isn't
  an `Error`, show `Something went wrong`.

Model this as one status value, not three booleans:
`"idle" | "saving" | "saved" | "error"`. Three booleans allow states that make
no sense (saving *and* saved), and the interviewer may ask why you didn't.

<!-- part -->

## Part 3 — Editing, and switching notes

Now the same form edits existing notes.

```tsx
NoteForm({ initial, onSubmit, onCancel }: {
  initial?: NoteDraft;
  onSubmit: (draft: NoteDraft) => Promise<void>;
  onCancel?: () => void;
})

export function NoteEditor({ notes, onSave }: {
  notes: (NoteDraft & { id: string })[];
  onSave: (id: string, draft: NoteDraft) => Promise<void>;
}): JSX.Element
```

`NoteForm`:
- Starts from `initial` when given (empty otherwise).
- With `initial`, `Save` stays disabled until something actually differs
  from it (on top of the Part 1 rules). After a successful save, keep the
  saved values in the fields and count them as the new starting point.
  Without `initial`, a save still clears the form, as before.
- A `Cancel` button (only when `onCancel` is given) puts the fields back to
  `initial` and calls `onCancel`.

`NoteEditor` shows one `<button>` per note (its title). Clicking one opens
the form for that note, and saving calls `onSave(id, draft)`.

The trap: open note A, type something, then click note B. If the form is the
same component instance, its state still holds A's draft. The fix isn't an
effect that copies props into state — it's `<NoteForm key={note.id} … />`. A
new key means a new instance with fresh state. Expect to be asked why.
