## Selecting a meeting

The starter has a working `MeetingList` from the previous problem; the `TODO`s mark what's new.

Now a two-pane layout: the list on the left, the selected meeting on the right.

```tsx
export function MeetingList(props: {
  meetings: Meeting[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}): JSX.Element

export default function App({ meetings }: { meetings: Meeting[] }): JSX.Element
```

- In `MeetingList`, each title becomes a `<button>` that calls `onSelect(id)`.
  The selected meeting's `<li>` gets `aria-current="true"`.
- `App` owns the selection (lifting state up: the list reports clicks, the
  parent decides). Before anything is selected, the right pane says
  `Select a meeting`.
- Once selected, the right pane shows the title as an `<h2>` and each attendee
  in a list.
- Store the selected **id**, not the meeting object. If the parent passes
  fresh data (the title was renamed), the detail pane must show the new title.
  If the selected meeting disappears, go back to `Select a meeting`.

> Why the id? A copied object is a second source of truth that goes stale the
> moment props change. Keep the minimum in state and **derive** the rest while
> rendering.
