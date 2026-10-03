// 21b - React 14: Refs and Focus: reference solution.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

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

preview(() => <InlineTitle title="Quarterly yoghurt review" onRename={(t) => console.log("renamed to", t)} />);
