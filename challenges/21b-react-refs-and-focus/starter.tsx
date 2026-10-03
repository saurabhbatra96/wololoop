// 21b - React 14: Refs and Focus
//
// Fill in InlineTitle. Run (Ctrl+Enter) renders the preview() into the Preview tab.

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export function InlineTitle({ title, onRename }: { title: string; onRename: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // TODO: an effect on [editing]:
  //   editing just started -> focus the input
  //   editing just ended   -> focus the Rename button (but not on the very first render)

  // TODO: finish(commit) - if committing and the trimmed draft is non-blank and different, onRename(it);
  //   then leave editing. Enter and blur can both fire for one edit: make sure onRename runs at most once.

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // TODO: Enter commits, Escape cancels
  }

  if (editing) {
    return (
      <label>
        Note title
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
      </label>
    );
  }
  return (
    <div>
      <h2>{title}</h2>
      {/* TODO: clicking Rename starts editing with a fresh draft */}
      <button ref={buttonRef} type="button">Rename</button>
    </div>
  );
}

preview(() => <InlineTitle title="Quarterly yoghurt review" onRename={(t) => console.log("renamed to", t)} />);
