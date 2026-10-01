// 22 - Mock: Meeting Notes App (45 minutes)
//
// Run (Ctrl+Enter) renders the preview() at the bottom, with a fake API
// that answers after a short delay - use it to click around.

import { useEffect, useState } from "react";

export interface NoteSummary {
  id: string;
  title: string;
  createdAt: string; // ISO 8601
  ownerName: string;
}

export interface Note extends NoteSummary {
  summary: string;
}

export interface NotesPage {
  notes: NoteSummary[];
  nextCursor: string | null;
}

export interface NotesApi {
  listNotes(params: { cursor?: string; query?: string }): Promise<NotesPage>;
  getNote(id: string): Promise<Note>;
  renameNote(id: string, title: string): Promise<NoteSummary>;
}

export default function NotesApp({ api }: { api: NotesApi }) {
  // TODO
  return <p>TODO</p>;
}

// ------------------------------------------------------------------ a fake API for Run

const TITLES = ["Quarterly yoghurt review", "Standup", "Design review: sidebar", "1:1 with Raisin", "Hiring sync",
  "Roadmap planning", "Customer call: Acme", "Retro", "Offsite logistics", "Investor update prep"];
const DB: Note[] = TITLES.map((title, i) => ({
  id: "n" + (i + 1), title, ownerName: i % 2 ? "Raisin Patel" : "Oat Benson",
  createdAt: new Date(Date.UTC(2026, 8, 30 - i, 9)).toISOString(), summary: "Summary of " + title + ".",
}));
const later = <T,>(value: T, ms = 400) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

export const demoApi: NotesApi = {
  listNotes: ({ cursor, query }) => {
    const matches = DB.filter((n) => !query || n.title.toLowerCase().includes(query.toLowerCase()));
    const start = Number(cursor ?? 0);
    const page = matches.slice(start, start + 4).map(({ summary, ...rest }) => rest);
    return later({ notes: page, nextCursor: start + 4 < matches.length ? String(start + 4) : null });
  },
  getNote: (id) => later({ ...DB.find((n) => n.id === id)! }),
  renameNote: (id, title) => {
    const note = DB.find((n) => n.id === id)!;
    note.title = title.trim();
    const { summary, ...rest } = note;
    return later(rest, 700);
  },
};

preview(() => <NotesApp api={demoApi} />);
