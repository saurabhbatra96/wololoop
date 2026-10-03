## A custom hook, with undo

The starter has the finished reducer and component from the previous problem; the `TODO`s mark what's new.

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
  not create an empty undo step (the reducer's "same reference" rule from React 10 makes
  that easy to detect).
- `ActionItems` now uses the hook, and gets an `Undo` button, disabled when
  `canUndo` is false.

Hint: keep `{ past: ActionItem[][]; present: ActionItem[] }` in a reducer that
**wraps** `itemsReducer`. The tests call the hook directly, from inside a
test component.

> Likely question: "why is `useActionItems` a hook and not a plain function?"
> Because it calls other hooks. The rules of hooks — top level only, same
> order every render — are what make that safe.
