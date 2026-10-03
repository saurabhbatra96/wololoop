// 18a - React 4: A Controlled Form: reference solution.

import { useState, type FormEvent } from "react";

export interface NoteDraft {
  title: string;
  body: string;
}

const MAX_TITLE = 80;

export function NoteForm({ onSubmit }: { onSubmit: (draft: NoteDraft) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const tooLong = title.length > MAX_TITLE;
  const canSave = title.trim() !== "" && !tooLong;

  function handleSubmit(event: FormEvent) {
    event.preventDefault(); // a real <form> would otherwise reload the page
    if (!canSave) return;
    onSubmit({ title: title.trim(), body });
    setTitle("");
    setBody("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="note-title">Title</label>
      <input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>{title.length} / {MAX_TITLE}</div>
      {tooLong && <div>Title is too long</div>}

      <label htmlFor="note-body">Body</label>
      <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} />

      <button type="submit" disabled={!canSave}>Save</button>
    </form>
  );
}

preview(() => <NoteForm onSubmit={(draft) => console.log("submitted", draft)} />);
