// 19a - React 7: Loading, Error, Data: reference solution.

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

preview(() => <NoteDetail id="n1" api={demoApi} />);
