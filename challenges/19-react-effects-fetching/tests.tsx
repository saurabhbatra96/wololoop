// Tests for 19 - Effects and Data Fetching.

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

// ------------------------------------------------------------------ part 1

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

// ------------------------------------------------------------------ part 2

test(2, "a new id shows Loading…, not the old note", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.resolve(note("n1", "Standup"));
  await screen.findByRole("heading", { name: "Standup" });
  view.rerender(<NoteDetail id="n2" api={f.api} />);
  screen.getByText("Loading…");
  assertEqual(screen.queryByRole("heading"), null);
  assertEqual(f.calls.map((c) => c.id), ["n1", "n2"]);
  f.calls[1].d.resolve(note("n2", "Retro"));
  await screen.findByRole("heading", { name: "Retro" });
});

test(2, "a slow old response can't overwrite a newer one", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  f.calls[1].d.resolve(note("b", "Note B"));
  await screen.findByRole("heading", { name: "Note B" });
  f.calls[0].d.resolve(note("a", "Note A"));
  await settle();
  await settle();
  screen.getByRole("heading", { name: "Note B" });
});

test(2, "a slow old error doesn't show up either", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  f.calls[1].d.resolve(note("b", "Note B"));
  await screen.findByRole("heading", { name: "Note B" });
  f.calls[0].d.reject(new Error("A failed"));
  await settle();
  await settle();
  assertEqual(screen.queryByRole("alert"), null);
});

test(2, "switching back and forth ends on the last id", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  view.rerender(<NoteDetail id="a" api={f.api} />);
  f.calls[2].d.resolve(note("a", "Latest A"));
  f.calls[1].d.resolve(note("b", "Note B"));
  f.calls[0].d.resolve(note("a", "Old A"));
  await settle();
  await settle();
  screen.getByRole("heading", { name: "Latest A" });
});

// ------------------------------------------------------------------ part 3

test(3, "passes a signal, and aborts it when the id changes", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  assert(f.calls[0].signal !== undefined, "pass an AbortSignal to api.getNote");
  assertEqual(f.calls[0].signal!.aborted, false);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  assertEqual([f.calls[0].signal!.aborted, f.calls[1].signal?.aborted], [true, false]);
});

test(3, "unmounting aborts the request in flight", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.unmount();
  assertEqual(f.calls[0].signal?.aborted, true);
});

test(3, "an aborted request doesn't show the error screen", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="a" api={f.api} />);
  view.rerender(<NoteDetail id="b" api={f.api} />);
  f.calls[0].d.reject(new DOMException("The operation was aborted.", "AbortError"));
  await settle();
  assertEqual(screen.queryByRole("alert"), null);
  screen.getByText("Loading…");
});

test(3, "refreshMs re-fetches in the background without a Loading… flash", async () => {
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

test(3, "a failed refresh keeps the note on screen", async () => {
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

test(3, "the refresh timer stops on unmount", async () => {
  const f = fakeApi();
  const view = render(<NoteDetail id="n1" api={f.api} refreshMs={20} />);
  f.calls[0].d.resolve(note("n1"));
  await waitFor(() => assert(f.calls.length >= 2, "no refresh"));
  view.unmount();
  const before = f.calls.length;
  await sleepMs(120);
  assertEqual(f.calls.length, before, "still fetching after unmount - a leaked interval");
});

test(3, "no refreshMs, no polling", async () => {
  const f = fakeApi();
  render(<NoteDetail id="n1" api={f.api} />);
  f.calls[0].d.resolve(note("n1"));
  await sleepMs(80);
  assertEqual(f.calls.length, 1);
});
