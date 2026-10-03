// 19a - React 7: Loading, Error, Data
//
// Fill in NoteDetail. Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

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
  // TODO: a way for Retry to re-run the fetch (hint: a counter in state, listed in the effect's dependencies)

  // TODO: useEffect(() => { ... api.getNote(id) ... }, [/* what does it depend on? */]);
  //   success -> { status: "ready", note }
  //   failure -> { status: "error", message }  ("Unknown error" if it isn't an Error)

  if (state.status === "loading") return <p>Loading…</p>;
  // TODO: the error screen: <p role="alert">Couldn't load note: ...</p> and a Retry button
  // TODO: the note: an <h2> title and a <p> summary
  return <p>TODO</p>;
}

const demoApi: NotesApi = {
  getNote: (id) => new Promise((resolve) => setTimeout(() => resolve({
    id, title: "Quarterly yoghurt review (" + id + ")", summary: "It went well. Greek remains the only yoghurt.",
  }), 600)),
};

preview(() => <NoteDetail id="n1" api={demoApi} />);
