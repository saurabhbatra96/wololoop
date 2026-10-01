// Tests for 20 - Reducers and Custom Hooks.

import { act } from "react";
import { itemsReducer, ActionItems } from "./your_code";
/** @stage 2 */
import { useActionItems } from "./your_code";
/** @stage 3 */
import { useDebouncedValue } from "./your_code";

const item = (id: string, text: string, done = false) => ({ id, text, done });
const frozen = <T,>(items: T[]) => Object.freeze(items.map((i) => Object.freeze(i))) as T[];
const STATE = frozen([item("a", "Send budget"), item("b", "Book offsite", true), item("c", "Email Fig")]);
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texts = () => screen.queryAllByRole("checkbox").map((c) => c.closest("label")!.textContent);

// ------------------------------------------------------------------ part 1

test(1, "add trims and appends; blank is ignored (same reference)", () => {
  const next = itemsReducer(STATE, { type: "add", id: "d", text: "  Call Oat  " });
  assertEqual(next.map((i) => [i.id, i.text, i.done]).at(-1), ["d", "Call Oat", false]);
  assertEqual(next.length, 4);
  assert(itemsReducer(STATE, { type: "add", id: "e", text: "   " }) === STATE, "a blank add must return the same state");
});

test(1, "toggle, edit, remove - without mutating", () => {
  assertEqual(itemsReducer(STATE, { type: "toggle", id: "a" })[0].done, true);
  assertEqual(itemsReducer(STATE, { type: "edit", id: "c", text: " Email Fig today " })[2].text, "Email Fig today");
  assertEqual(itemsReducer(STATE, { type: "remove", id: "b" }).map((i) => i.id), ["a", "c"]);
  assertEqual(STATE.map((i) => [i.id, i.done]), [["a", false], ["b", true], ["c", false]]);
});

test(1, "no-ops return the same state object", () => {
  assert(itemsReducer(STATE, { type: "toggle", id: "zzz" }) === STATE, "toggle unknown id");
  assert(itemsReducer(STATE, { type: "remove", id: "zzz" }) === STATE, "remove unknown id");
  assert(itemsReducer(STATE, { type: "edit", id: "a", text: "  " }) === STATE, "blank edit");
  const noneDone = frozen([item("a", "x")]);
  assert(itemsReducer(noneDone, { type: "clearDone" }) === noneDone, "clearDone with nothing done");
  assertEqual(itemsReducer(STATE, { type: "clearDone" }).map((i) => i.id), ["a", "c"]);
});

test(1, "the action type is a closed union", () => {
  // @ts-expect-error - "archive" is not an Action
  if (false as boolean) itemsReducer(STATE, { type: "archive", id: "a" });
  // @ts-expect-error - add needs an id
  if (false as boolean) itemsReducer(STATE, { type: "add", text: "x" });
});

test(1, "ActionItems: add with the button or Enter, input clears", async () => {
  render(<ActionItems />);
  const box = screen.getByLabelText(/new action item/i) as HTMLInputElement;
  await user.type(box, "Send budget");
  await user.click(screen.getByRole("button", { name: "Add" }));
  await user.type(box, "Book offsite{Enter}");
  assertEqual(texts(), ["Send budget", "Book offsite"]);
  assertEqual(box.value, "");
});

test(1, "ActionItems: toggle, remove, count, clear done", async () => {
  render(<ActionItems initial={[...STATE]} />);
  screen.getByText("1 of 3 done");
  await user.click(screen.getByLabelText("Send budget"));
  screen.getByText("2 of 3 done");
  await user.click(screen.getByRole("button", { name: "Remove Email Fig" }));
  assertEqual(texts(), ["Send budget", "Book offsite"]);
  await user.click(screen.getByRole("button", { name: "Clear done" }));
  assertEqual(texts(), []);
  assertEqual((screen.getByRole("button", { name: "Clear done" }) as HTMLButtonElement).disabled, true);
});

// ------------------------------------------------------------------ part 2

/** @stage 2 - renders the hook and hands back its latest result */
function renderHook<T>(hook: () => T) {
  const latest: { current: T } = { current: undefined as T };
  function Probe() {
    latest.current = hook();
    return null;
  }
  render(<Probe />);
  return latest;
}

test(2, "the hook adds with fresh ids and counts done", () => {
  const h = renderHook(() => useActionItems());
  act(() => h.current.add("One"));
  act(() => h.current.add("Two"));
  const [a, b] = h.current.items;
  assert(a.id !== b.id, "ids must be unique");
  act(() => h.current.toggle(b.id));
  assertEqual([h.current.items.map((i) => i.text), h.current.doneCount], [["One", "Two"], 1]);
});

test(2, "undo steps back one change at a time", () => {
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

test(2, "ignored changes don't create undo steps", () => {
  const h = renderHook(() => useActionItems([...STATE]));
  act(() => h.current.add("   "));
  act(() => h.current.toggle("nope"));
  assertEqual(h.current.canUndo, false);
});

test(2, "the Undo button", async () => {
  render(<ActionItems initial={[...STATE]} />);
  const undo = () => screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
  assertEqual(undo().disabled, true);
  await user.click(screen.getByRole("button", { name: "Remove Send budget" }));
  assertEqual(texts(), ["Book offsite", "Email Fig"]);
  await user.click(undo());
  assertEqual(texts(), ["Send budget", "Book offsite", "Email Fig"]);
  assertEqual(undo().disabled, true);
});

// ------------------------------------------------------------------ part 3

test(3, "useDebouncedValue starts equal, then lags by delayMs", async () => {
  const seen: string[] = [];
  function Probe({ value }: { value: string }) {
    const v = useDebouncedValue(value, 40);
    if (seen[seen.length - 1] !== v) seen.push(v);
    return null;
  }
  const view = render(<Probe value="a" />);
  view.rerender(<Probe value="ab" />);
  assertEqual(seen, ["a"], "no instant update");
  await waitFor(() => assertEqual(seen, ["a", "ab"]));
});

test(3, "rapid changes restart the wait", async () => {
  const seen: string[] = [];
  function Probe({ value }: { value: string }) {
    const v = useDebouncedValue(value, 60);
    if (seen[seen.length - 1] !== v) seen.push(v);
    return null;
  }
  const view = render(<Probe value="" />);
  for (const v of ["a", "ab", "abc"]) {
    view.rerender(<Probe value={v} />);
    await act(async () => { await sleepMs(15); });
  }
  await waitFor(() => assertEqual(seen, ["", "abc"]));
  await sleepMs(100);
  assertEqual(seen, ["", "abc"], "an intermediate value leaked out");
});

test(3, "the filter applies after typing stops", async () => {
  render(<ActionItems initial={[...STATE]} />);
  await user.type(screen.getByLabelText("Filter"), "BOOK");
  assertEqual(texts().length, 3, "filtered on the first keystroke - no debounce");
  await waitFor(() => assertEqual(texts(), ["Book offsite"]));
  screen.getByText("1 of 3 done");
});

test(3, "no matches says so", async () => {
  render(<ActionItems initial={[...STATE]} />);
  await user.type(screen.getByLabelText("Filter"), "zebra");
  await screen.findByText("No matching items");
});
