// 19 - Effects and Data Fetching: reference solution, all three parts.

import { useEffect, useState } from "react";

export interface Note {
  id: string;
  title: string;
  summary: string;
}

export interface NotesApi {
  getNote(id: string, signal?: AbortSignal): Promise<Note>;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; note: Note };

export function NoteDetail({ id, api, refreshMs }: { id: string; api: NotesApi; refreshMs?: number }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0); // bumping it re-runs the effect: that's Retry

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    const load = (background: boolean) => {
      api.getNote(id, controller.signal).then(
        (note) => {
          if (!controller.signal.aborted) setState({ status: "ready", note });
        },
        (err: unknown) => {
          if (controller.signal.aborted || background) return; // stale, cancelled, or just a failed refresh
          setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        },
      );
    };

    load(false);
    const timer = refreshMs ? setInterval(() => load(true), refreshMs) : undefined;
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [id, api, refreshMs, attempt]);

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
    id, title: "Quarterly yoghurt review", summary: "It went well. Greek remains the only yoghurt.",
  }), 600)),
};

preview(() => <NoteDetail id="n1" api={demoApi} />);
