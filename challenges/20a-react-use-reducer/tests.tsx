// Tests for 20a - React 10: A Reducer for Action Items.

import { itemsReducer, ActionItems } from "./your_code";
const item = (id: string, text: string, done = false) => ({ id, text, done });
const frozen = <T,>(items: T[]) => Object.freeze(items.map((i) => Object.freeze(i))) as T[];
const STATE = frozen([item("a", "Send budget"), item("b", "Book offsite", true), item("c", "Email Fig")]);
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texts = () => screen.queryAllByRole("checkbox").map((c) => c.closest("label")!.textContent);

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
