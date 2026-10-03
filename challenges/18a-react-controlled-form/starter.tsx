// 18a - React 4: A Controlled Form
//
// Fill in NoteForm. Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { useState, type FormEvent } from "react";

export interface NoteDraft {
  title: string;
  body: string;
}

const MAX_TITLE = 80;

export function NoteForm({ onSubmit }: { onSubmit: (draft: NoteDraft) => void }) {
  // TODO: state for title and body (controlled inputs)
  // TODO: canSave = title isn't blank and is at most MAX_TITLE characters

  function handleSubmit(event: FormEvent) {
    event.preventDefault(); // a real <form> would otherwise reload the page
    // TODO: if allowed, onSubmit({ title: <trimmed>, body }), then clear both fields
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* TODO: <label htmlFor="note-title">Title</label> + <input id="note-title" value=... onChange=... /> */}
      {/* TODO: the counter, "0 / 80", and "Title is too long" when over */}
      {/* TODO: a Body <label> + <textarea> */}
      {/* TODO: <button type="submit" disabled={...}>Save</button> */}
    </form>
  );
}

preview(() => <NoteForm onSubmit={(draft) => console.log("submitted", draft)} />);
