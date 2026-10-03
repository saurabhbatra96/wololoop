## Rename in place (refs and focus)

Click a note's title to rename it, right there.

```tsx
export function InlineTitle({ title, onRename }: {
  title: string;
  onRename: (title: string) => void;
}): JSX.Element
```

- Normally: the title as an `<h2>`, and a `Rename` button.
- Clicking `Rename` swaps both for an input labelled `Note title`, filled
  with the title and **focused**, so the user can type straight away. Use a
  ref and focus it in an effect (or `autoFocus` — know the difference: the
  effect version is what you'd use for anything conditional).
- **Enter** or **leaving the field** (blur) commits: if the trimmed text is
  non-blank and different, call `onRename(trimmed)`. Then go back to the
  heading. `onRename` is called at most once per edit.
- **Escape** cancels: no call, back to the heading.
- Afterwards, focus goes **back to the `Rename` button**. Otherwise a keyboard
  user is dumped at the top of the page. That's the accessibility detail
  interviewers notice.

Careful with the order of events: Enter commits and unmounts the input, and
in some browsers the unmount fires a blur too. Don't commit twice.
