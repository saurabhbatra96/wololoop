// 19c - React 9: Cancelling and Refreshing
//
// NoteDetail is already race-safe (the previous problem's answer). The TODOs are what's new.

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

export function NoteDetail({ id, api, refreshMs }: { id: string; api: NotesApi; refreshMs?: number }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // TODO: swap the ignore flag for an AbortController: pass controller.signal to api.getNote,
    //   abort in the cleanup, and treat an aborted request as "ignore" (no error screen).
    let ignore = false;
    setState({ status: "loading" });
    api.getNote(id).then(
      (note) => {
        if (!ignore) setState({ status: "ready", note });
      },
      (err: unknown) => {
        if (!ignore) setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
      },
    );
    // TODO: when refreshMs is set, re-fetch every refreshMs in the background:
    //   no "Loading…" flash, and a failed refresh keeps the current note. Clear the interval in the cleanup.
    return () => {
      ignore = true;
    };
  }, [id, api, attempt]); // TODO: refreshMs belongs here too

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

preview(() => <NoteDetail id="n1" api={demoApi} refreshMs={3000} />);
