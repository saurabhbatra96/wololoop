// 18b - React 5: Async Saving: reference solution.

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
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const tooLong = title.length > MAX_TITLE;
  const canSave = title.trim() !== "" && !tooLong && status !== "saving";

  // Typing again clears the "Saved" message.
  const edit = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (status === "saved") setStatus("idle");
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    setStatus("saving");
    try {
      await onSubmit({ title: title.trim(), body });
      setStatus("saved");
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="note-title">Title</label>
      <input id="note-title" value={title} onChange={(e) => edit(setTitle)(e.target.value)} />
      <div>{title.length} / {MAX_TITLE}</div>
      {tooLong && <div>Title is too long</div>}

      <label htmlFor="note-body">Body</label>
      <textarea id="note-body" value={body} onChange={(e) => edit(setBody)(e.target.value)} />

      <button type="submit" disabled={!canSave}>{status === "saving" ? "Saving…" : "Save"}</button>
      {status === "saved" && <p>Saved</p>}
      {status === "error" && <p role="alert">{error}</p>}
    </form>
  );
}

const slowSave = (draft: NoteDraft) => new Promise<void>((resolve, reject) =>
  setTimeout(() => (draft.title.includes("fail") ? reject(new Error("You're offline")) : resolve()), 800));

preview(() => <NoteForm onSubmit={slowSave} />);
