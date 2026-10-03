// 20b - React 11: A Custom Hook, with Undo: reference solution.

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export type Action =
  | { type: "add"; id: string; text: string }
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "remove"; id: string }
  | { type: "clearDone" };

export function itemsReducer(state: ActionItem[], action: Action): ActionItem[] {
  switch (action.type) {
    case "add": {
      const text = action.text.trim();
      return text ? [...state, { id: action.id, text, done: false }] : state;
    }
    case "toggle":
      return state.some((i) => i.id === action.id)
        ? state.map((i) => (i.id === action.id ? { ...i, done: !i.done } : i))
        : state;
    case "edit": {
      const text = action.text.trim();
      const target = state.find((i) => i.id === action.id);
      if (!text || !target || target.text === text) return state;
      return state.map((i) => (i.id === action.id ? { ...i, text } : i));
    }
    case "remove":
      return state.some((i) => i.id === action.id) ? state.filter((i) => i.id !== action.id) : state;
    case "clearDone":
      return state.some((i) => i.done) ? state.filter((i) => !i.done) : state;
  }
}

type History = { past: ActionItem[][]; present: ActionItem[] };

function historyReducer(history: History, action: Action | { type: "undo" }): History {
  if (action.type === "undo") {
    if (!history.past.length) return history;
    return { past: history.past.slice(0, -1), present: history.past[history.past.length - 1] };
  }
  const next = itemsReducer(history.present, action);
  if (next === history.present) return history; // nothing changed: no undo step
  return { past: [...history.past, history.present], present: next };
}

/** What useActionItems hands back. */
export interface ActionItemsApi {
  items: ActionItem[];
  add(text: string): void;
  toggle(id: string): void;
  edit(id: string, text: string): void;
  remove(id: string): void;
  clearDone(): void;
  undo(): void;
  canUndo: boolean;
  doneCount: number;
}

export function useActionItems(initial?: ActionItem[]): ActionItemsApi {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: initial ?? [] });
  const nextId = useRef(0);
  const items = history.present;
  return {
    items,
    add: (text: string) => dispatch({ type: "add", id: "item-" + ++nextId.current, text }),
    toggle: (id: string) => dispatch({ type: "toggle", id }),
    edit: (id: string, text: string) => dispatch({ type: "edit", id, text }),
    remove: (id: string) => dispatch({ type: "remove", id }),
    clearDone: () => dispatch({ type: "clearDone" }),
    undo: () => dispatch({ type: "undo" }),
    canUndo: history.past.length > 0,
    doneCount: items.filter((i) => i.done).length,
  };
}

export function ActionItems({ initial }: { initial?: ActionItem[] }) {
  const list = useActionItems(initial);
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    list.add(draft);
    setDraft("");
  }

  return (
    <section>
      <form onSubmit={submit}>
        <label>New action item <input value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
        <button type="submit">Add</button>
      </form>
      <ul>
        {list.items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.done} onChange={() => list.toggle(item.id)} />
              {item.text}
            </label>
            <button type="button" aria-label={"Remove " + item.text} onClick={() => list.remove(item.id)}>×</button>
          </li>
        ))}
      </ul>
      <p>{list.doneCount} of {list.items.length} done</p>
      <button type="button" onClick={list.clearDone} disabled={list.doneCount === 0}>Clear done</button>
      <button type="button" onClick={list.undo} disabled={!list.canUndo}>Undo</button>
    </section>
  );
}

preview(() => (
  <ActionItems initial={[
    { id: "a1", text: "Send the yoghurt budget to finance", done: false },
    { id: "a2", text: "Book the Q4 offsite", done: true },
  ]} />
));
