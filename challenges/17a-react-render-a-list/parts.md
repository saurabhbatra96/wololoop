## Render a list

A warm-up to get your hands used to JSX again. Granola's sidebar lists your
meetings; build that list.

```tsx
export interface Meeting {
  id: string;
  title: string;
  startsAt: string;      // ISO 8601, e.g. "2026-10-01T09:30:00Z"
  attendees: string[];   // emails
  hasNotes: boolean;
}

export function MeetingList({ meetings }: { meetings: Meeting[] }): JSX.Element
```

- Render a `<ul>` with one `<li>` per meeting, **earliest first**. Sort a
  copy — props are read-only, and `meetings.sort()` sorts the caller's array in
  place. (The tests hand you a frozen array, so that would throw.)
- Each item shows the **title**, and the attendee count as `"3 attendees"` or
  `"1 attendee"` in its own element.
- Show a `Notes` badge **only** when `hasNotes` is true.
- No meetings → render `<p>No meetings yet</p>` instead of an empty list.
- Every `<li>` needs a stable `key`. Use the id, not the array index: an
  index key makes React reuse the wrong DOM (and the wrong state) when the list
  is re-sorted. The tests listen for React's missing-key warning.

The tests find things the way a user would — by text and by role (`listitem`,
`button`, `heading`) — so plain semantic HTML is what passes. That's also how
Testing Library works, if the interviewer asks how you'd test this.
