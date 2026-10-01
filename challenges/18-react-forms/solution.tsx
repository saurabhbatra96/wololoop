// 18 - Forms and Controlled Inputs: reference solution, all three parts.

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
  onSubmit: (draft: NoteDraft) => Promise<void> | void;
  onCancel?: () => void;
}) {
  const [baseline, setBaseline] = useState<NoteDraft>(initial ?? EMPTY);
  const [title, setTitle] = useState(baseline.title);
  const [body, setBody] = useState(baseline.body);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const tooLong = title.length > MAX_TITLE;
  const dirty = title !== baseline.title || body !== baseline.body;
  const canSave = title.trim() !== "" && !tooLong && status !== "saving" && (!initial || dirty);

  const edit = (setter: (v: string) => void) => (value: string) => {
    setter(value);
    if (status === "saved") setStatus("idle");
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const draft = { title: title.trim(), body };
    setStatus("saving");
    try {
      await onSubmit(draft);
      setStatus("saved");
      if (initial) {
        setBaseline(draft);
        setTitle(draft.title);
      } else {
        setTitle("");
        setBody("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  function cancel() {
    setTitle(baseline.title);
    setBody(baseline.body);
    setStatus("idle");
    onCancel?.();
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
      {onCancel && <button type="button" onClick={cancel}>Cancel</button>}
      {status === "saved" && <p>Saved</p>}
      {status === "error" && <p role="alert">{error}</p>}
    </form>
  );
}

export function NoteEditor({ notes, onSave }: {
  notes: (NoteDraft & { id: string })[];
  onSave: (id: string, draft: NoteDraft) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = notes.find((n) => n.id === openId);
  return (
    <div>
      <ul>
        {notes.map((n) => (
          <li key={n.id}><button type="button" onClick={() => setOpenId(n.id)}>{n.title}</button></li>
        ))}
      </ul>
      {open && (
        // key: a different note is a different form, with its own fresh state
        <NoteForm key={open.id} initial={{ title: open.title, body: open.body }}
                  onSubmit={(draft) => onSave(open.id, draft)} onCancel={() => setOpenId(null)} />
      )}
    </div>
  );
}

preview(() => (
  <NoteEditor
    notes={[{ id: "n1", title: "Standup", body: "Blocked on review" }, { id: "n2", title: "Retro", body: "" }]}
    onSave={async (id, draft) => console.log("saved", id, draft)}
  />
));
