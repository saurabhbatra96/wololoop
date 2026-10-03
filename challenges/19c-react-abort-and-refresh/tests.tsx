// Tests for 19c - React 9: Cancelling and Refreshing.

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

test(1, "passes a signal, and aborts it when the id changes", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  assert(f.calls[0].signal !== undefined, "pass an AbortSignal to api.getNote");
  assertEqual(f.calls[0].signal!.aborted, false);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  assertEqual([f.calls[0].signal!.aborted, f.calls[1].signal?.aborted], [true, false]);
});

test(1, "unmounting aborts the request in flight", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.unmount();
  assertEqual(f.calls[0].signal?.aborted, true);
});

test(1, "an aborted request doesn't show the error screen", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  f.calls[0].d.reject(new DOMException("The operation was aborted.", "AbortError"));
  await settle();
  assertEqual(screen.queryByRole("alert"), null);
  screen.getByText("Loading…");
});

test(1, "refreshMs re-fetches in the background without a Loading… flash", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} refreshMs={30} />);
  f.calls[0].d.resolve(note("n1", "v1"));
  await screen.findByRole("heading", { name: "v1" });
  await waitFor(() => assert(f.calls.length >= 2, "no refresh after 30ms"));
  screen.getByRole("heading", { name: "v1" });
  assertEqual(screen.queryByText("Loading…"), null, "a background refresh must not flash Loading…");
  f.calls[1].d.resolve(note("n1", "v2"));
  await screen.findByRole("heading", { name: "v2" });
});

test(1, "a failed refresh keeps the note on screen", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} refreshMs={30} />);
  f.calls[0].d.resolve(note("n1", "v1"));
  await screen.findByRole("heading", { name: "v1" });
  await waitFor(() => assert(f.calls.length >= 2, "no refresh"));
  f.calls[1].d.reject(new Error("flaky"));
  await settle();
  screen.getByRole("heading", { name: "v1" });
  assertEqual(screen.queryByRole("alert"), null);
});

test(1, "the refresh timer stops on unmount", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="n1" api={f.api} refreshMs={20} />);
  f.calls[0].d.resolve(note("n1"));
  await waitFor(() => assert(f.calls.length >= 2, "no refresh"));
  view.unmount();
  const before = f.calls.length;
  await sleepMs(120);
  assertEqual(f.calls.length, before, "still fetching after unmount - a leaked interval");
});

test(1, "no refreshMs, no polling", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.resolve(note("n1"));
  await sleepMs(80);
  assertEqual(f.calls.length, 1);
});
