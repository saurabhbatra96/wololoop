// Tests for 22 - Mock: Meeting Notes App.

import NotesApp from "./your_code";

type TestSummary = { id: string; title: string; createdAt: string; ownerName: string };
type TestPage = { notes: TestSummary[]; nextCursor: string | null };
type TestNote = TestSummary & { summary: string };

const summary = (i: number, title = "Note " + i): TestSummary =>
  ({ id: "n" + i, title, createdAt: "2026-09-" + String(10 + i).padStart(2, "0") + "T09:00:00Z", ownerName: "Oat Benson" });
const page = (ids: number[], nextCursor: string | null = null): TestPage => ({ notes: ids.map((i) => summary(i)), nextCursor });
const full = (i: number, title = "Note " + i): TestNote => ({ ...summary(i, title), summary: "Summary of note " + i });

/** An API whose every call you settle by hand. */
function fakeApi() {
  const lists: { params: { cursor?: string; query?: string }; d: ReturnType<typeof createDeferred<TestPage>> }[] = [];
  const gets: { id: string; d: ReturnType<typeof createDeferred<TestNote>> }[] = [];
  const renames: { id: string; title: string; d: ReturnType<typeof createDeferred<TestSummary>> }[] = [];
  const api = {
    listNotes(params: { cursor?: string; query?: string }) {
      const d = createDeferred<TestPage>();
      lists.push({ params: { ...params }, d });
      return d.promise;
    },
    getNote(id: string) {
      const d = createDeferred<TestNote>();
      gets.push({ id, d });
      return d.promise;
    },
    renameNote(id: string, title: string) {
      const d = createDeferred<TestSummary>();
      renames.push({ id, title, d });
      return d.promise;
    },
  };
  return { api, lists, gets, renames };
}

const noteButtons = () => screen.queryAllByRole("button").map((b) => b.textContent ?? "").filter((t) => /^Note |^Renamed|^Roadmap/.test(t));
const searchBox = () => screen.getByLabelText("Search notes");
const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loaded(ids: number[], nextCursor: string | null = null) {
  const f = fakeApi();
  render(<NotesApp api={f.api} />);
  f.lists[0].d.resolve(page(ids, nextCursor));
  await screen.findByRole("button", { name: "Note " + ids[0] });
  return f;
}

// ------------------------------------------------------------------ part 1

test(1, "loads the first page on mount", async () => {
  const f = fakeApi();
  render(<NotesApp api={f.api} />);
  screen.getByText("Loading notes…");
  assertEqual(f.lists.map((c) => c.params), [{}]);
  f.lists[0].d.resolve(page([1, 2, 3]));
  await screen.findByRole("button", { name: "Note 1" });
  assertEqual(noteButtons(), ["Note 1", "Note 2", "Note 3"]);
  assertEqual(screen.queryByText("Loading notes…"), null);
});

test(1, "an empty account says so", async () => {
  const f = fakeApi();
  render(<NotesApp api={f.api} />);
  f.lists[0].d.resolve(page([]));
  await screen.findByText("No notes yet");
});

test(1, "a failed load can be retried", async () => {
  const f = fakeApi();
  render(<NotesApp api={f.api} />);
  f.lists[0].d.reject(new Error("503"));
  assertEqual((await screen.findByRole("alert")).textContent, "Couldn't load notes");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  assertEqual(f.lists.length, 2);
  f.lists[1].d.resolve(page([1]));
  await screen.findByRole("button", { name: "Note 1" });
  assertEqual(screen.queryByRole("alert"), null);
});

test(1, "clicking a note loads and shows it", async () => {
  const f = await loaded([1, 2, 3]);
  screen.getByText("Select a note");
  await user.click(screen.getByRole("button", { name: "Note 2" }));
  screen.getByText("Loading note…");
  assertEqual(f.gets.map((g) => g.id), ["n2"]);
  f.gets[0].d.resolve(full(2));
  await screen.findByRole("heading", { name: "Note 2" });
  screen.getByText("Summary of note 2");
});

test(1, "the last note clicked wins", async () => {
  const f = await loaded([1, 2]);
  await user.click(screen.getByRole("button", { name: "Note 1" }));
  await user.click(screen.getByRole("button", { name: "Note 2" }));
  f.gets[1].d.resolve(full(2));
  await screen.findByRole("heading", { name: "Note 2" });
  f.gets[0].d.resolve(full(1));
  await settle();
  await settle();
  screen.getByRole("heading", { name: "Note 2" });
});

// ------------------------------------------------------------------ part 2

test(2, "Load more appends the next page", async () => {
  const f = await loaded([1, 2], "c1");
  await user.click(screen.getByRole("button", { name: "Load more" }));
  assertEqual(f.lists[1].params, { cursor: "c1" });
  const busy = screen.getByRole("button", { name: "Loading…" }) as HTMLButtonElement;
  assertEqual(busy.disabled, true);
  f.lists[1].d.resolve(page([3, 4], null));
  await screen.findByRole("button", { name: "Note 4" });
  assertEqual(noteButtons(), ["Note 1", "Note 2", "Note 3", "Note 4"]);
  assertEqual(screen.queryByRole("button", { name: /Load more|Loading…/ }), null, "no more pages, no button");
});

test(2, "no Load more when there's no next page", async () => {
  await loaded([1, 2], null);
  assertEqual(screen.queryByRole("button", { name: "Load more" }), null);
});

test(2, "search waits for a pause, then asks the server once", async () => {
  const f = await loaded([1, 2, 3]);
  await user.type(searchBox(), " road ");
  assertEqual(f.lists.length, 1, "searched on a keystroke - no debounce");
  await waitFor(() => assertEqual(f.lists.length, 2));
  assertEqual(f.lists[1].params, { query: "road" });
  f.lists[1].d.resolve({ notes: [summary(9, "Roadmap planning")], nextCursor: null });
  await screen.findByRole("button", { name: "Roadmap planning" });
  assertEqual(screen.queryByRole("button", { name: "Note 1" }), null, "search replaces the list");
  await sleepMs(350);
  assertEqual(f.lists.length, 2, "one request per pause, not per keystroke");
});

test(2, "Load more while searching sends the query too", async () => {
  const f = await loaded([1]);
  await user.type(searchBox(), "note");
  await waitFor(() => assertEqual(f.lists.length, 2));
  f.lists[1].d.resolve(page([1, 2], "c2"));
  await user.click(await screen.findByRole("button", { name: "Load more" }));
  assertEqual(f.lists[2].params, { cursor: "c2", query: "note" });
});

test(2, "late results for an old query are ignored", async () => {
  const f = await loaded([1]);
  await user.type(searchBox(), "ro");
  await waitFor(() => assertEqual(f.lists.length, 2));
  await user.type(searchBox(), "admap");
  await waitFor(() => assertEqual(f.lists.length, 3));
  f.lists[2].d.resolve({ notes: [summary(9, "Roadmap planning")], nextCursor: null });
  await screen.findByRole("button", { name: "Roadmap planning" });
  f.lists[1].d.resolve({ notes: [summary(7, "Roadmap planning"), summary(8, "Robot demo")], nextCursor: null });
  await settle();
  await settle();
  assertEqual(screen.queryByRole("button", { name: "Robot demo" }), null, "stale 'ro' results replaced 'roadmap'");
});

test(2, "no matches, and clearing the box", async () => {
  const f = await loaded([1, 2]);
  await user.type(searchBox(), "roadmap");
  await waitFor(() => assertEqual(f.lists.length, 2));
  f.lists[1].d.resolve(page([]));
  await screen.findByText('No notes match "roadmap"');
  await user.clear(searchBox());
  await waitFor(() => assertEqual(f.lists.length, 3));
  assertEqual(f.lists[2].params, {});
  f.lists[2].d.resolve(page([1, 2]));
  await screen.findByRole("button", { name: "Note 2" });
});

test(2, "the open note stays open while you search", async () => {
  const f = await loaded([1, 2]);
  await user.click(screen.getByRole("button", { name: "Note 2" }));
  f.gets[0].d.resolve(full(2));
  await screen.findByRole("heading", { name: "Note 2" });
  await user.type(searchBox(), "zzz");
  await waitFor(() => assertEqual(f.lists.length, 2));
  f.lists[1].d.resolve(page([]));
  await screen.findByText('No notes match "zzz"');
  screen.getByRole("heading", { name: "Note 2" });
});

// ------------------------------------------------------------------ part 3

/** @stage 3 */
async function openNote2() {
  const f = await loaded([1, 2]);
  await user.click(screen.getByRole("button", { name: "Note 2" }));
  f.gets[0].d.resolve(full(2));
  await screen.findByRole("heading", { name: "Note 2" });
  await user.click(screen.getByRole("button", { name: "Rename" }));
  return f;
}

test(3, "Rename opens a prefilled form; blank can't be saved", async () => {
  await openNote2();
  const box = screen.getByLabelText("Title") as HTMLInputElement;
  assertEqual(box.value, "Note 2");
  await user.clear(box);
  assertEqual((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled, true);
});

test(3, "the new title shows everywhere before the server answers", async () => {
  const f = await openNote2();
  const box = screen.getByLabelText("Title");
  await user.clear(box);
  await user.type(box, "Renamed note{Enter}");
  assertEqual(f.renames.map((r) => [r.id, r.title]), [["n2", "Renamed note"]]);
  screen.getByRole("heading", { name: "Renamed note" });
  screen.getByRole("button", { name: "Renamed note" });
  assertEqual(screen.queryByLabelText("Title"), null, "the form closes on save");
});

test(3, "the server's version of the title wins", async () => {
  const f = await openNote2();
  const box = screen.getByLabelText("Title");
  await user.clear(box);
  await user.type(box, "renamed  note{Enter}");
  f.renames[0].d.resolve({ ...summary(2), title: "Renamed note (tidied)" });
  await screen.findByRole("heading", { name: "Renamed note (tidied)" });
  screen.getByRole("button", { name: "Renamed note (tidied)" });
});

test(3, "a failed rename rolls back and says so", async () => {
  const f = await openNote2();
  const box = screen.getByLabelText("Title");
  await user.clear(box);
  await user.type(box, "Renamed note{Enter}");
  f.renames[0].d.reject(new Error("409"));
  assertEqual((await screen.findByRole("alert")).textContent, "Couldn't rename note");
  screen.getByRole("heading", { name: "Note 2" });
  screen.getByRole("button", { name: "Note 2" });
});
