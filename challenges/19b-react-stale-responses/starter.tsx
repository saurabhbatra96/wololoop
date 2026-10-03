// 19b - React 8: When the Id Changes
//
// NoteDetail already loads a note (the previous problem's answer) - but it has a race. The TODO marks the fix.

import { useEffect, useState } from "react";

export interface Note {
  id: string;
  title: string;
  summary: string;
}

export interface NotesApi {
  getNote(id: string, signal?: AbortSignal): Promise<Note>;
}

/** The three screens, as one value - so "loading" and "error" can never both be true. */
type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; note: Note };

export function NoteDetail({ id, api }: { id: string; api: NotesApi }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // TODO: click note A (slow), then note B (fast): B arrives, then A arrives late and overwrites it.
    //   Give each run of this effect its own `ignore` flag, set it in a cleanup function,
    //   and check it before calling setState.
    setState({ status: "loading" });
    api.getNote(id).then(
      (note) => setState({ status: "ready", note }),
      (err: unknown) => setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" }),
    );
  }, [id, api, attempt]);

  if (state.status === "loading") return <p>Loading…</p>;
  if (state.status === "error") {
    return (
      <div>
        <p role="alert">Couldn't load note: {state.message}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </div>
    );
  }
  return (
    <article>
      <h2>{state.note.title}</h2>
      <p>{state.note.summary}</p>
    </article>
  );
}

const demoApi: NotesApi = {
  getNote: (id) => new Promise((resolve) => setTimeout(() => resolve({
    id, title: "Quarterly yoghurt review (" + id + ")", summary: "It went well. Greek remains the only yoghurt.",
  }), 600)),
};

/** A tiny parent for the preview: click between notes to change `id`. */
function Demo() {
  const [id, setId] = useState("n1");
  return (
    <div>
      {["n1", "n2", "n3"].map((n) => <button key={n} type="button" onClick={() => setId(n)}>{n}</button>)}
      <NoteDetail id={id} api={demoApi} />
    </div>
  );
}

preview(() => <Demo />);
