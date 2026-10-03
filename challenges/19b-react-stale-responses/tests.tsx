// Tests for 19b - React 8: When the Id Changes.

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

test(1, "a new id shows Loading…, not the old note", async () => {
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

test(1, "a slow old response can't overwrite a newer one", async () => {
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

test(1, "a slow old error doesn't show up either", async () => {
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

test(1, "switching back and forth ends on the last id", async () => {
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
