## A debounced filter

The starter has everything from the previous problem working; the `TODO`s mark what's new.

With 200 action items, you want a filter box. Filtering on every keystroke
is fine for 200 items, but this is also the shape of "search the server as
they type", where you **do** want to wait for a pause.

```ts
export function useDebouncedValue<T>(value: T, delayMs: number): T
```

- Returns `value` as it was **`delayMs` after it last changed**. It starts out
  equal to the first value, with no wait.
- Rapid changes restart the wait: typing `a`, `ab`, `abc` quickly produces
  `abc` once — never `a` or `ab`.
- Clear the pending timer in the effect's cleanup (on change and on unmount).

In `ActionItems`, add an input labelled `Filter`. The list shows items whose
text contains the filter (case-insensitive), **150 ms** after typing stops.
When nothing matches, show `No matching items`. The summary still counts every
item.
