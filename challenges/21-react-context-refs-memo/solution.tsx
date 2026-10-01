// 21 - Context, Refs and Memo: reference solution, all three parts.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface User {
  name: string;
  email: string;
}

// ------------------------------------------------------------------ part 1

const CurrentUserContext = createContext<User | null>(null);

export function CurrentUserProvider({ user, children }: { user: User; children: ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <CurrentUserProvider>");
  return user;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => w[0]).join("").toUpperCase();
}

export function Avatar() {
  const user = useCurrentUser();
  return <span title={user.email}>{initials(user.name)}</span>;
}

export function Greeting() {
  const user = useCurrentUser();
  return <p>Hi, {user.name.trim().split(/\s+/)[0]}</p>;
}

// ------------------------------------------------------------------ part 2

export function InlineTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const finished = useRef(false); // guards against Enter-then-blur committing twice
  const wasEditing = useRef(false);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) {
      buttonRef.current?.focus();
    }
    wasEditing.current = editing;
  }, [editing]);

  function start() {
    setDraft(title);
    finished.current = false;
    setEditing(true);
  }

  function finish(commit: boolean) {
    if (finished.current) return;
    finished.current = true;
    const next = draft.trim();
    if (commit && next && next !== title) onRename(next);
    setEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") finish(true);
    if (event.key === "Escape") finish(false);
  }

  if (editing) {
    return (
      <label>
        Note title
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)}
               onKeyDown={onKeyDown} onBlur={() => finish(true)} />
      </label>
    );
  }
  return (
    <div>
      <h2>{title}</h2>
      <button ref={buttonRef} type="button" onClick={start}>Rename</button>
    </div>
  );
}

// ------------------------------------------------------------------ part 3

type SearchNote = { id: string; title: string; preview: string };

export function NoteSearch({ notes, search }: {
  notes: SearchNote[];
  search: (notes: SearchNote[], query: string) => SearchNote[];
}) {
  const [query, setQuery] = useState("");
  const [showPreviews, setShowPreviews] = useState(false);
  const results = useMemo(() => search(notes, query), [notes, query, search]);

  return (
    <div>
      <label>Search notes <input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label>
        <input type="checkbox" checked={showPreviews} onChange={(e) => setShowPreviews(e.target.checked)} />
        Show previews
      </label>
      <ul>
        {results.map((n) => (
          <li key={n.id}>
            {n.title}
            {showPreviews && <p>{n.preview}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

preview(() => (
  <CurrentUserProvider user={{ name: "Oat Benson", email: "oat@granola.ai" }}>
    <Avatar /> <Greeting />
    <InlineTitle title="Quarterly yoghurt review" onRename={(t) => console.log("renamed to", t)} />
  </CurrentUserProvider>
));
