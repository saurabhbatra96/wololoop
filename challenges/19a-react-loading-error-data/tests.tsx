// Tests for 19a - React 7: Loading, Error, Data.

import { NoteDetail } from "./your_code";
type TestNote = { id: string; title: string; summary: string };

/** An api whose every call you settle by hand. */
function fakeApi() {
  const calls: { id: string; signal?: AbortSignal; d: ReturnType<typeof createDeferred<TestNote>> }[] = [];
  const api = {
    getNote(id: string, signal?: AbortSignal) {
      const d = createDeferred<TestNote>();
      calls.push({ id, signal, d });
      return d.promise;
    },
  };
  return { api, calls };
}

const note = (id: string, title = "Note " + id) => ({ id, title, summary: "Summary of " + id });
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

test(1, "fetches on mount and shows Loading… meanwhile", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  screen.getByText("Loading…");
  assertEqual(f.calls.map((c) => c.id), ["n1"]);
  f.calls[0].d.resolve(note("n1", "Standup"));
  await screen.findByRole("heading", { name: "Standup" });
  screen.getByText("Summary of n1");
  assertEqual(screen.queryByText("Loading…"), null);
});

test(1, "fetches once, not on every render", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.resolve(note("n1"));
  await screen.findByRole("heading");
  view.rerender(<NoteDetail id="n1" api={f.api} />);
  await settle();
  assertEqual(f.calls.length, 1);
});

test(1, "an error shows the message", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.reject(new Error("503 Service Unavailable"));
  const alert = await screen.findByRole("alert");
  assertEqual(alert.textContent, "Couldn't load note: 503 Service Unavailable");
  assertEqual(screen.queryByText("Loading…"), null);
});

test(1, "a non-Error failure says Unknown error", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.reject("nope");
  assertEqual((await screen.findByRole("alert")).textContent, "Couldn't load note: Unknown error");
});

test(1, "Retry shows Loading… and fetches again", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.reject(new Error("timeout"));
  await user.click(await screen.findByRole("button", { name: "Retry" }));
  screen.getByText("Loading…");
  assertEqual(f.calls.length, 2);
  f.calls[1].d.resolve(note("n1", "Standup"));
  await screen.findByRole("heading", { name: "Standup" });
});
