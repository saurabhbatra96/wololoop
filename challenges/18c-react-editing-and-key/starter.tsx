// 18c - React 6: Editing, and Switching Notes
//
// The async form already works (the previous problem's answer). The TODOs are what's new.

import { useState, type FormEvent } from "react";

export interface NoteDraft {
  title: string;
  body: string;
}

const MAX_TITLE = 80;

const EMPTY: NoteDraft = { title: "", body: "" };

type Status = "idle" | "saving" | "saved" | "error";

export function NoteForm({ initial, onSubmit, onCancel }: {
  initial?: NoteDraft;
  onSubmit: (draft: NoteDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  // TODO: start from `initial` (or EMPTY), and remember a "baseline" to compare against.
  //       After a successful save of an existing note, the saved values become the new baseline.
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const tooLong = title.length > MAX_TITLE;
  // TODO: with `initial`, Save also needs something to differ from the baseline
  const canSave = title.trim() !== "" && !tooLong && status !== "saving";

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
      // TODO: with `initial`, keep the saved values (title trimmed) instead of clearing
      setTitle("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  // TODO: cancel() - back to the baseline, then onCancel()

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="note-title">Title</label>
      <input id="note-title" value={title} onChange={(e) => edit(setTitle)(e.target.value)} />
      <div>{title.length} / {MAX_TITLE}</div>
      {tooLong && <div>Title is too long</div>}

      <label htmlFor="note-body">Body</label>
      <textarea id="note-body" value={body} onChange={(e) => edit(setBody)(e.target.value)} />

      <button type="submit" disabled={!canSave}>{status === "saving" ? "Saving…" : "Save"}</button>
      {/* TODO: a Cancel button, only when onCancel is given */}
      {status === "saved" && <p>Saved</p>}
      {status === "error" && <p role="alert">{error}</p>}
    </form>
  );
}

export function NoteEditor({ notes, onSave }: {
  notes: (NoteDraft & { id: string })[];
  onSave: (id: string, draft: NoteDraft) => Promise<void>;
}) {
  // TODO: which note is open (by id)
  return (
    <div>
      {/* TODO: one <button> per note, with its title, that opens it */}
      {/* TODO: the open note's <NoteForm key={...} initial={...} onSubmit={...} onCancel={...} /> */}
    </div>
  );
}

preview(() => (
  <NoteEditor
    notes={[{ id: "n1", title: "Standup", body: "Blocked on review" }, { id: "n2", title: "Retro", body: "" }]}
    onSave={async (id, draft) => console.log("saved", id, draft)}
  />
));
