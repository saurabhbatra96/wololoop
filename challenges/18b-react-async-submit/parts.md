## Saving is async

The starter has the working form from the previous problem; `onSubmit` now returns a promise, and the `TODO`s mark what's new.

Saving talks to a server, so `onSubmit` now returns a promise:

```tsx
onSubmit: (draft: NoteDraft) => Promise<void>
```

- While saving: the button reads `Saving…` and is disabled, and a second
  click or Enter must not submit again.
- Success: clear the form and show `Saved`. The `Saved` message goes away as
  soon as the user types again.
- Failure: **keep what they typed**, re-enable the button, and show the
  error's message in an element with `role="alert"`. If the thing thrown isn't
  an `Error`, show `Something went wrong`.

Model this as one status value, not three booleans:
`"idle" | "saving" | "saved" | "error"`. Three booleans allow states that make
no sense (saving *and* saved), and the interviewer may ask why you didn't.
