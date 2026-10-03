// Tests for 21c - React 15: useMemo.

import { NoteSearch } from "./your_code";
const OAT = { name: "Oat Benson", email: "oat@granola.ai" };

/** console.error calls made while fn runs (React reports render errors there too). */
function quietly<T>(fn: () => T): T {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

const NOTES = [
  { id: "n1", title: "Standup", preview: "Blocked on review" },
  { id: "n2", title: "Retro", preview: "More snacks" },
  { id: "n3", title: "Design review", preview: "Ship the sidebar" },
];

function countingSearch() {
  const calls: string[] = [];
  const search = (notes: typeof NOTES, query: string) => {
    calls.push(query);
    return notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()));
  };
  return { calls, search };
}

test(1, "lists search results, previews on request", async () => {
  const { search } = countingSearch();
  render(<NoteSearch notes={NOTES} search={search} />);
  assertEqual(screen.getAllByRole("listitem").length, 3);
  assertEqual(screen.queryByText("Blocked on review"), null);
  await user.click(screen.getByLabelText("Show previews"));
  screen.getByText("Blocked on review");
  await user.type(screen.getByLabelText("Search notes"), "review");
  assertEqual(screen.getAllByRole("listitem").length, 1);
});

test(1, "toggling previews doesn't re-run the search", async () => {
  const { calls, search } = countingSearch();
  render(<NoteSearch notes={NOTES} search={search} />);
  const before = calls.length;
  await user.click(screen.getByLabelText("Show previews"));
  await user.click(screen.getByLabelText("Show previews"));
  assertEqual(calls.length, before, "search ran again although notes and query didn't change");
});

test(1, "a new query or new notes do re-run it", async () => {
  const { calls, search } = countingSearch();
  const view = render(<NoteSearch notes={NOTES} search={search} />);
  await user.type(screen.getByLabelText("Search notes"), "r");
  assertEqual(calls.at(-1), "r");
  const before = calls.length;
  view.rerender(<NoteSearch notes={[...NOTES]} search={search} />);
  assertEqual(calls.length, before + 1);
});
