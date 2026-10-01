// Tests for 21 - Context, Refs and Memo.

import { CurrentUserProvider, useCurrentUser, Avatar, Greeting } from "./your_code";
/** @stage 2 */
import { InlineTitle } from "./your_code";
/** @stage 3 */
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

// ------------------------------------------------------------------ part 1

test(1, "Avatar shows initials, with the email as a title", () => {
  render(<CurrentUserProvider user={OAT}><Avatar /></CurrentUserProvider>);
  const avatar = screen.getByText("OB");
  assertEqual(avatar.getAttribute("title"), "oat@granola.ai");
});

test(1, "initials: one name, many names, lower case", () => {
  const cases: [string, string][] = [["Oat", "O"], ["Oat van der Benson", "OB"], ["raisin patel", "RP"]];
  for (const [name, want] of cases) {
    const view = render(<CurrentUserProvider user={{ name, email: "x@y.z" }}><Avatar /></CurrentUserProvider>);
    assertEqual(view.container.textContent, want, name);
    view.unmount();
  }
});

test(1, "Greeting uses the first name", () => {
  render(<CurrentUserProvider user={OAT}><div><section><Greeting /></section></div></CurrentUserProvider>);
  screen.getByText("Hi, Oat");
});

test(1, "a new user reaches every consumer", () => {
  const view = render(<CurrentUserProvider user={OAT}><Avatar /><Greeting /></CurrentUserProvider>);
  view.rerender(<CurrentUserProvider user={{ name: "Raisin Patel", email: "raisin@granola.ai" }}><Avatar /><Greeting /></CurrentUserProvider>);
  screen.getByText("RP");
  screen.getByText("Hi, Raisin");
});

test(1, "outside a provider, the hook throws a helpful error", () => {
  quietly(() => assertThrows(() => render(<Greeting />), "useCurrentUser must be used inside <CurrentUserProvider>"));
});

test(1, "the hook's type is User, not User | null", () => {
  function Probe() {
    const user = useCurrentUser();
    const email: string = user.email; // would not compile if the hook returned User | null
    return <span>{email}</span>;
  }
  render(<CurrentUserProvider user={OAT}><Probe /></CurrentUserProvider>);
  screen.getByText("oat@granola.ai");
});

// ------------------------------------------------------------------ part 2

const renameButton = () => screen.getByRole("button", { name: "Rename" });
const titleInput = () => screen.getByLabelText("Note title") as HTMLInputElement;

test(2, "a heading and a Rename button", () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  screen.getByRole("heading", { name: "Standup" });
  renameButton();
  assertEqual(screen.queryByLabelText("Note title"), null);
});

test(2, "Rename swaps in a focused, prefilled input", async () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  await user.click(renameButton());
  assertEqual(titleInput().value, "Standup");
  assert(document.activeElement === titleInput(), "the input should have focus");
  assertEqual(screen.queryByRole("heading"), null);
});

test(2, "Enter commits the trimmed title, once", async () => {
  const renamed: string[] = [];
  render(<InlineTitle title="Standup" onRename={(t) => renamed.push(t)} />);
  await user.click(renameButton());
  await user.clear(titleInput());
  await user.type(titleInput(), "  Daily standup {Enter}");
  await settle();
  assertEqual(renamed, ["Daily standup"]);
  assertEqual(screen.queryByLabelText("Note title"), null);
});

test(2, "Escape cancels", async () => {
  const renamed: string[] = [];
  render(<InlineTitle title="Standup" onRename={(t) => renamed.push(t)} />);
  await user.click(renameButton());
  await user.type(titleInput(), " (draft)");
  await user.keyboard("Escape");
  await settle();
  assertEqual(renamed, []);
  screen.getByRole("heading", { name: "Standup" });
});

test(2, "leaving the field commits", async () => {
  const renamed: string[] = [];
  render(<><InlineTitle title="Standup" onRename={(t) => renamed.push(t)} /><button type="button">Elsewhere</button></>);
  await user.click(renameButton());
  await user.type(titleInput(), " notes");
  await user.click(screen.getByRole("button", { name: "Elsewhere" }));
  await settle();
  assertEqual(renamed, ["Standup notes"]);
});

test(2, "blank or unchanged titles don't call onRename", async () => {
  const renamed: string[] = [];
  render(<InlineTitle title="Standup" onRename={(t) => renamed.push(t)} />);
  await user.click(renameButton());
  await user.type(titleInput(), "{Enter}");
  await user.click(renameButton());
  await user.clear(titleInput());
  await user.type(titleInput(), "   {Enter}");
  await settle();
  assertEqual(renamed, []);
});

test(2, "focus returns to the Rename button afterwards", async () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  await user.click(renameButton());
  await user.type(titleInput(), "!{Enter}");
  await settle();
  assert(document.activeElement === renameButton(), "focus was lost - it's on <" +
    (document.activeElement?.tagName.toLowerCase() ?? "nothing") + ">");
});

// ------------------------------------------------------------------ part 3

const NOTES = [
  { id: "n1", title: "Standup", preview: "Blocked on review" },
  { id: "n2", title: "Retro", preview: "More snacks" },
  { id: "n3", title: "Design review", preview: "Ship the sidebar" },
];

/** @stage 3 */
function countingSearch() {
  const calls: string[] = [];
  const search = (notes: typeof NOTES, query: string) => {
    calls.push(query);
    return notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()));
  };
  return { calls, search };
}

test(3, "lists search results, previews on request", async () => {
  const { search } = countingSearch();
  render(<NoteSearch notes={NOTES} search={search} />);
  assertEqual(screen.getAllByRole("listitem").length, 3);
  assertEqual(screen.queryByText("Blocked on review"), null);
  await user.click(screen.getByLabelText("Show previews"));
  screen.getByText("Blocked on review");
  await user.type(screen.getByLabelText("Search notes"), "review");
  assertEqual(screen.getAllByRole("listitem").length, 1);
});

test(3, "toggling previews doesn't re-run the search", async () => {
  const { calls, search } = countingSearch();
  render(<NoteSearch notes={NOTES} search={search} />);
  const before = calls.length;
  await user.click(screen.getByLabelText("Show previews"));
  await user.click(screen.getByLabelText("Show previews"));
  assertEqual(calls.length, before, "search ran again although notes and query didn't change");
});

test(3, "a new query or new notes do re-run it", async () => {
  const { calls, search } = countingSearch();
  const view = render(<NoteSearch notes={NOTES} search={search} />);
  await user.type(screen.getByLabelText("Search notes"), "r");
  assertEqual(calls.at(-1), "r");
  const before = calls.length;
  view.rerender(<NoteSearch notes={[...NOTES]} search={search} />);
  assertEqual(calls.length, before + 1);
});
