// 22 - Mock: Meeting Notes App - reference solution, all three parts.
//
// One of many reasonable shapes. What matters: one piece of state per
// concern, effects only for syncing with the server, and every async result
// checked for staleness before it lands.

import { useEffect, useRef, useState, type FormEvent } from "react";

export interface NoteSummary {
  id: string;
  title: string;
  createdAt: string;
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

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; notes: NoteSummary[]; nextCursor: string | null };

type DetailState = { status: "loading" } | { status: "ready"; note: Note };

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function NotesApp({ api }: { api: NotesApi }) {
  const [input, setInput] = useState("");
  const query = useDebouncedValue(input.trim(), 300);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRequest = useRef(0); // bumps with every new list: late pages for an old one are dropped

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState>({ status: "loading" });

  // Titles changed by a rename, keyed by id. The single place the list and the detail read from.
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [renameError, setRenameError] = useState(false);
  const titleOf = (n: NoteSummary) => titles[n.id] ?? n.title;

  useEffect(() => {
    let ignore = false;
    const request = ++listRequest.current;
    setList({ status: "loading" });
    setLoadingMore(false);
    api.listNotes(query ? { query } : {}).then(
      (page) => { if (!ignore) setList({ status: "ready", ...page }); },
      () => { if (!ignore) setList({ status: "error" }); },
    );
    return () => {
      ignore = true;
      if (listRequest.current === request) listRequest.current++;
    };
  }, [api, query, attempt]);

  useEffect(() => {
    if (!selectedId) return;
    let ignore = false;
    setDetail({ status: "loading" });
    api.getNote(selectedId).then((note) => { if (!ignore) setDetail({ status: "ready", note }); }, () => {});
    return () => { ignore = true; };
  }, [api, selectedId]);

  async function loadMore() {
    if (list.status !== "ready" || !list.nextCursor) return;
    const request = listRequest.current;
    setLoadingMore(true);
    try {
      const page = await api.listNotes(query ? { cursor: list.nextCursor, query } : { cursor: list.nextCursor });
      if (listRequest.current !== request) return;
      setList((prev) => prev.status === "ready"
        ? { status: "ready", notes: [...prev.notes, ...page.notes], nextCursor: page.nextCursor }
        : prev);
    } finally {
      if (listRequest.current === request) setLoadingMore(false);
    }
  }

  async function rename(id: string, previous: string, next: string) {
    setRenameError(false);
    setTitles((t) => ({ ...t, [id]: next }));
    try {
      const saved = await api.renameNote(id, next);
      setTitles((t) => ({ ...t, [id]: saved.title }));
    } catch {
      setTitles((t) => ({ ...t, [id]: previous }));
      setRenameError(true);
    }
  }

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <nav style={{ minWidth: 260 }}>
        <label>Search notes <input value={input} onChange={(e) => setInput(e.target.value)} /></label>
        {list.status === "loading" && <p>Loading notes…</p>}
        {list.status === "error" && (
          <div>
            <p role="alert">Couldn't load notes</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          </div>
        )}
        {list.status === "ready" && (
          list.notes.length === 0
            ? <p>{query ? `No notes match "${query}"` : "No notes yet"}</p>
            : (
              <ul>
                {list.notes.map((n) => (
                  <li key={n.id} aria-current={n.id === selectedId ? "true" : undefined}>
                    <button type="button" onClick={() => setSelectedId(n.id)}>{titleOf(n)}</button>
                    <small> {n.ownerName}</small>
                  </li>
                ))}
              </ul>
            )
        )}
        {list.status === "ready" && list.nextCursor && (
          <button type="button" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button>
        )}
      </nav>
      <main>
        {renameError && <p role="alert">Couldn't rename note</p>}
        {!selectedId ? <p>Select a note</p>
          : detail.status === "loading" ? <p>Loading note…</p>
          : <NoteDetail key={detail.note.id} note={detail.note} title={titleOf(detail.note)}
                        onRename={(next) => rename(detail.note.id, titleOf(detail.note), next)} />}
      </main>
    </div>
  );
}

function NoteDetail({ note, title, onRename }: { note: Note; title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!next) return;
    setEditing(false);
    if (next !== title) onRename(next);
  }

  return (
    <article>
      <h2>{title}</h2>
      {editing ? (
        <form onSubmit={submit}>
          <label>Title <input value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
          <button type="submit" disabled={!draft.trim()}>Save</button>
        </form>
      ) : (
        <button type="button" onClick={() => { setDraft(title); setEditing(true); }}>Rename</button>
      )}
      <p>{note.summary}</p>
    </article>
  );
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
