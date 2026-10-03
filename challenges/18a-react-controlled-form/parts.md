## A controlled form

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
