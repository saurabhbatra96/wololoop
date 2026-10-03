// 20a - React 10: A Reducer for Action Items: reference solution.

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

export function ActionItems({ initial }: { initial?: ActionItem[] }) {
  const [items, dispatch] = useReducer(itemsReducer, initial ?? []);
  const [draft, setDraft] = useState("");
  const nextId = useRef(0); // ids are made here, so the reducer stays pure
  const doneCount = items.filter((i) => i.done).length;

  function submit(event: FormEvent) {
    event.preventDefault();
    dispatch({ type: "add", id: "item-" + ++nextId.current, text: draft });
    setDraft("");
  }

  return (
    <section>
      <form onSubmit={submit}>
        <label>New action item <input value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
        <button type="submit">Add</button>
      </form>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.done} onChange={() => dispatch({ type: "toggle", id: item.id })} />
              {item.text}
            </label>
            <button type="button" aria-label={"Remove " + item.text} onClick={() => dispatch({ type: "remove", id: item.id })}>×</button>
          </li>
        ))}
      </ul>
      <p>{doneCount} of {items.length} done</p>
      <button type="button" onClick={() => dispatch({ type: "clearDone" })} disabled={doneCount === 0}>Clear done</button>
    </section>
  );
}

preview(() => (
  <ActionItems initial={[
    { id: "a1", text: "Send the yoghurt budget to finance", done: false },
    { id: "a2", text: "Book the Q4 offsite", done: true },
  ]} />
));
