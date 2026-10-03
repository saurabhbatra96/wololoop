## Don't redo expensive work (useMemo)

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
