// Tests for 20b - React 11: A Custom Hook, with Undo.

import { ActionItems, useActionItems } from "./your_code";
import { act } from "react";
const item = (id: string, text: string, done = false) => ({ id, text, done });
const frozen = <T,>(items: T[]) => Object.freeze(items.map((i) => Object.freeze(i))) as T[];
const STATE = frozen([item("a", "Send budget"), item("b", "Book offsite", true), item("c", "Email Fig")]);
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texts = () => screen.queryAllByRole("checkbox").map((c) => c.closest("label")!.textContent);

function renderHook<T>(hook: () => T) {
  const latest: { current: T } = { current: undefined as T };
  function Probe() {
    latest.current = hook();
    return null;
  }
  render(<Probe />);
  return latest;
}

test(1, "the hook adds with fresh ids and counts done", () => {
  const h = renderHook(() => useActionItems());
  act(() => h.current.add("One"));
  act(() => h.current.add("Two"));
  const [a, b] = h.current.items;
  assert(a.id !== b.id, "ids must be unique");
  act(() => h.current.toggle(b.id));
  assertEqual([h.current.items.map((i) => i.text), h.current.doneCount], [["One", "Two"], 1]);
});

test(1, "undo steps back one change at a time", () => {
  const h = renderHook(() => useActionItems([...STATE]));
  assertEqual(h.current.canUndo, false);
  act(() => h.current.toggle("a"));
  act(() => h.current.remove("c"));
  act(() => h.current.undo());
  assertEqual(h.current.items.map((i) => [i.id, i.done]), [["a", true], ["b", true], ["c", false]]);
  act(() => h.current.undo());
  assertEqual(h.current.items.map((i) => i.done), [false, true, false]);
  assertEqual(h.current.canUndo, false);
  act(() => h.current.undo());
  assertEqual(h.current.items.length, 3, "undo with no history is a no-op");
});

test(1, "ignored changes don't create undo steps", () => {
  const h = renderHook(() => useActionItems([...STATE]));
  act(() => h.current.add("   "));
  act(() => h.current.toggle("nope"));
  assertEqual(h.current.canUndo, false);
});

test(1, "the Undo button", async () => {
  render(<ActionItems initial={[...STATE]} />);
  const undo = () => screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
  assertEqual(undo().disabled, true);
  await user.click(screen.getByRole("button", { name: "Remove Send budget" }));
  assertEqual(texts(), ["Book offsite", "Email Fig"]);
  await user.click(undo());
  assertEqual(texts(), ["Send budget", "Book offsite", "Email Fig"]);
  assertEqual(undo().disabled, true);
});
