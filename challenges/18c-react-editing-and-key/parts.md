## Editing, and switching notes

The starter has the async form from the previous problem, with the new props already in its signature; the `TODO`s mark what's new.

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
  from it (on top of the blank / too-long rules). After a successful save, keep the
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
