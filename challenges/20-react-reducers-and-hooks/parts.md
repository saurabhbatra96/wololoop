## Part 1 — A reducer for action items

Granola pulls action items out of meetings. Build the checklist that holds
them, with its state in a reducer.

```tsx
export interface ActionItem { id: string; text: string; done: boolean }

export type Action =
  | { type: "add"; id: string; text: string }
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "remove"; id: string }
  | { type: "clearDone" };

export function itemsReducer(state: ActionItem[], action: Action): ActionItem[]
export function ActionItems({ initial }: { initial?: ActionItem[] }): JSX.Element
```

`itemsReducer` must be **pure**: never mutate `state` (the tests freeze it),
no `Date.now()` or random ids inside it — that's why `add` carries its `id`.

- `add` trims the text and appends; blank text is ignored.
- `edit` trims; a blank edit is ignored.
- When an action changes nothing (unknown id, blank text, nothing done to
  clear), return **the same `state` object**. React skips the re-render when
  the reducer hands back the same reference.

`ActionItems` uses `useReducer(itemsReducer, initial ?? [])`:
- An input labelled `New action item` and an `Add` button; Enter adds too.
  Clear the input after adding. Make ids however you like, outside the reducer.
- Each item: a checkbox whose label is the item's text, and a `Remove` button
  with `aria-label="Remove <text>"`.
- A summary, `1 of 3 done`, and a `Clear done` button that's disabled when
  nothing is done.

<!-- part -->

## Part 2 — A custom hook, with undo

Pull the logic out of the component into a hook, so another screen can reuse
it — and add undo.

```ts
export function useActionItems(initial?: ActionItem[]): {
  items: ActionItem[];
  add(text: string): void;
  toggle(id: string): void;
  edit(id: string, text: string): void;
  remove(id: string): void;
  clearDone(): void;
  undo(): void;
  canUndo: boolean;
  doneCount: number;
}
```

- `undo()` goes back one change; calling it again goes further back.
  `canUndo` is false when there's nothing to undo.
- Only changes that **changed something** count. An ignored blank `add` must
  not create an empty undo step (your "same reference" rule from Part 1 makes
  that easy to detect).
- `ActionItems` now uses the hook, and gets an `Undo` button, disabled when
  `canUndo` is false.

Hint: keep `{ past: ActionItem[][]; present: ActionItem[] }` in a reducer that
**wraps** `itemsReducer`. The tests call the hook directly, from inside a
test component.

> Likely question: "why is `useActionItems` a hook and not a plain function?"
> Because it calls other hooks. The rules of hooks — top level only, same
> order every render — are what make that safe.

<!-- part -->

## Part 3 — A debounced filter

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
