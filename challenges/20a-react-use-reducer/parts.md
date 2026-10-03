## A reducer for action items

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
