## Part 1 — Who's signed in? (context)

Half the components in an app need the current user: avatars, greetings,
"shared by you" labels. Passing it through every layer of props is prop
drilling; context is the fix.

```tsx
export interface User { name: string; email: string }

export function CurrentUserProvider({ user, children }: { user: User; children: React.ReactNode }): JSX.Element
export function useCurrentUser(): User
export function Avatar(): JSX.Element
export function Greeting(): JSX.Element
```

- `useCurrentUser()` reads the context. Used outside a provider, it throws
  `Error("useCurrentUser must be used inside <CurrentUserProvider>")`. Create
  the context with `createContext<User | null>(null)` so "no provider" is
  something you can detect — and so the hook returns `User`, not `User | null`.
- `Avatar` renders the user's initials in a `<span>` whose `title` is their
  email: `"Oat Benson"` → `OB`, `"Oat"` → `O`, `"Oat van der Benson"` → `OB`
  (first and last word), upper-cased.
- `Greeting` renders `<p>Hi, Oat</p>` — the first name.
- A new `user` prop on the provider updates every consumer.

> Expect "when would you *not* use context?" Context re-renders every consumer
> when its value changes, so it suits slow-changing values (user, theme,
> locale), not a text field's keystrokes.

<!-- part -->

## Part 2 — Rename in place (refs and focus)

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

<!-- part -->

## Part 3 — Don't redo expensive work (useMemo)

Searching a big note list is slow, and you're handed the search function:

```tsx
export function NoteSearch({ notes, search }: {
  notes: { id: string; title: string; preview: string }[];
  search: (notes: { id: string; title: string; preview: string }[], query: string) => { id: string; title: string; preview: string }[];
}): JSX.Element
```

- An input labelled `Search notes`, and a checkbox labelled `Show previews`.
- List the results of `search(notes, query)` as `<li>`s with the title, plus
  the preview when `Show previews` is ticked.
- Toggling `Show previews` must **not** call `search` again — nothing it
  depends on changed. Changing the query or passing new `notes` must.

`useMemo(() => search(notes, query), [notes, query])` is the answer; the tests
count calls. Then be ready for the follow-ups: `useMemo` is a performance
hint, not a guarantee (React may drop the cache); `React.memo` does the same
for a whole component's render; `useCallback` is `useMemo` for functions, and
only matters when a memoised child or an effect depends on that function.
