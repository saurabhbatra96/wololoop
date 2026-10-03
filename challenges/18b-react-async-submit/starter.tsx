// 18b - React 5: Async Saving
//
// The form already works (the previous problem's answer). onSubmit now returns a promise; the TODOs are what's new.

import { useState, type FormEvent } from "react";

export interface NoteDraft {
  title: string;
  body: string;
}

const MAX_TITLE = 80;

type Status = "idle" | "saving" | "saved" | "error";

export function NoteForm({ onSubmit }: { onSubmit: (draft: NoteDraft) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  // TODO: const [status, setStatus] = useState<Status>("idle"); and somewhere to keep the error message

  const tooLong = title.length > MAX_TITLE;
  const canSave = title.trim() !== "" && !tooLong; // TODO: and not while saving

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    // TODO: status "saving"; await onSubmit(...); then either
    //   success: status "saved", clear the fields
    //   failure: status "error", keep the fields, remember the message ("Something went wrong" for non-Errors)
    onSubmit({ title: title.trim(), body });
    setTitle("");
    setBody("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="note-title">Title</label>
      {/* TODO: typing again should clear the "Saved" message */}
      <input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>{title.length} / {MAX_TITLE}</div>
      {tooLong && <div>Title is too long</div>}

      <label htmlFor="note-body">Body</label>
      <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} />

      {/* TODO: the button reads "Saving…" while saving */}
      <button type="submit" disabled={!canSave}>Save</button>
      {/* TODO: <p>Saved</p> after a save, <p role="alert">message</p> after a failure */}
    </form>
  );
}

const slowSave = (draft: NoteDraft) => new Promise<void>((resolve, reject) =>
  setTimeout(() => (draft.title.includes("fail") ? reject(new Error("You're offline")) : resolve()), 800));

preview(() => <NoteForm onSubmit={slowSave} />);
