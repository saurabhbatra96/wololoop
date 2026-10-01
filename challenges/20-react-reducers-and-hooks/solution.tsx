// 20 - Reducers and Custom Hooks: reference solution, all three parts.

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

// ------------------------------------------------------------------ part 1

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

// ------------------------------------------------------------------ part 2

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

export function useActionItems(initial?: ActionItem[]) {
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

// ------------------------------------------------------------------ part 3

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ------------------------------------------------------------------ component

export function ActionItems({ initial }: { initial?: ActionItem[] }) {
  const list = useActionItems(initial);
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const query = useDebouncedValue(filter.trim().toLowerCase(), 150);
  const visible = query ? list.items.filter((i) => i.text.toLowerCase().includes(query)) : list.items;

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
      <label>Filter <input value={filter} onChange={(e) => setFilter(e.target.value)} /></label>
      {visible.length === 0 && query ? <p>No matching items</p> : (
        <ul>
          {visible.map((item) => (
            <li key={item.id}>
              <label>
                <input type="checkbox" checked={item.done} onChange={() => list.toggle(item.id)} />
                {item.text}
              </label>
              <button type="button" aria-label={"Remove " + item.text} onClick={() => list.remove(item.id)}>×</button>
            </li>
          ))}
        </ul>
      )}
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
