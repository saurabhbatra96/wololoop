// Tests for 20c - React 12: A Debounced Filter.

import { ActionItems, useDebouncedValue } from "./your_code";
import { act } from "react";
const item = (id: string, text: string, done = false) => ({ id, text, done });
const frozen = <T,>(items: T[]) => Object.freeze(items.map((i) => Object.freeze(i))) as T[];
const STATE = frozen([item("a", "Send budget"), item("b", "Book offsite", true), item("c", "Email Fig")]);
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));
const texts = () => screen.queryAllByRole("checkbox").map((c) => c.closest("label")!.textContent);

test(1, "useDebouncedValue starts equal, then lags by delayMs", async () => {
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

test(1, "rapid changes restart the wait", async () => {
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

test(1, "the filter applies after typing stops", async () => {
  render(<ActionItems initial={[...STATE]} />);
  await user.type(screen.getByLabelText("Filter"), "BOOK");
  assertEqual(texts().length, 3, "filtered on the first keystroke - no debounce");
  await waitFor(() => assertEqual(texts(), ["Book offsite"]));
  screen.getByText("1 of 3 done");
});

test(1, "no matches says so", async () => {
  render(<ActionItems initial={[...STATE]} />);
  await user.type(screen.getByLabelText("Filter"), "zebra");
  await screen.findByText("No matching items");
});
