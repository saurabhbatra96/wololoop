// 19b - React 8: When the Id Changes: reference solution.

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
  const [attempt, setAttempt] = useState(0); // bumping it re-runs the effect: that's Retry

  useEffect(() => {
    let ignore = false; // each run of the effect gets its own flag
    setState({ status: "loading" });
    api.getNote(id).then(
      (note) => {
        if (!ignore) setState({ status: "ready", note });
      },
      (err: unknown) => {
        if (!ignore) setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
      },
    );
    return () => {
      ignore = true; // a newer id (or unmount) has taken over: drop this response
    };
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
