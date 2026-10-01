// 19 - Effects and Data Fetching
//
// Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { useEffect, useState } from "react";

export interface Note {
  id: string;
  title: string;
  summary: string;
}

export interface NotesApi {
  getNote(id: string, signal?: AbortSignal): Promise<Note>;
}

export function NoteDetail({ id, api }: { id: string; api: NotesApi }) {
  // TODO: fetch the note on mount; show loading, error, or the note
  return <p>TODO</p>;
}

const demoApi: NotesApi = {
  getNote: (id) => new Promise((resolve) => setTimeout(() => resolve({
    id, title: "Quarterly yoghurt review", summary: "It went well. Greek remains the only yoghurt.",
  }), 600)),
};

preview(() => <NoteDetail id="n1" api={demoApi} />);
