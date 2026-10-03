// Tests for 21b - React 14: Refs and Focus.

import { InlineTitle } from "./your_code";
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

const renameButton = () => screen.getByRole("button", { name: "Rename" });
const titleInput = () => screen.getByLabelText("Note title") as HTMLInputElement;

test(1, "a heading and a Rename button", () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  screen.getByRole("heading", { name: "Standup" });
  renameButton();
  assertEqual(screen.queryByLabelText("Note title"), null);
});

test(1, "Rename swaps in a focused, prefilled input", async () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  await user.click(renameButton());
  assertEqual(titleInput().value, "Standup");
  assert(document.activeElement === titleInput(), "the input should have focus");
  assertEqual(screen.queryByRole("heading"), null);
});

test(1, "Enter commits the trimmed title, once", async () => {
  const renamed: string[] = [];
  render(<InlineTitle title="Standup" onRename={(t) => renamed.push(t)} />);
  await user.click(renameButton());
  await user.clear(titleInput());
  await user.type(titleInput(), "  Daily standup {Enter}");
  await settle();
  assertEqual(renamed, ["Daily standup"]);
  assertEqual(screen.queryByLabelText("Note title"), null);
});

test(1, "Escape cancels", async () => {
  const renamed: string[] = [];
  render(<InlineTitle title="Standup" onRename={(t) => renamed.push(t)} />);
  await user.click(renameButton());
  await user.type(titleInput(), " (draft)");
  await user.keyboard("Escape");
  await settle();
  assertEqual(renamed, []);
  screen.getByRole("heading", { name: "Standup" });
});

test(1, "leaving the field commits", async () => {
  const renamed: string[] = [];
  render(<><InlineTitle title="Standup" onRename={(t) => renamed.push(t)} /><button type="button">Elsewhere</button></>);
  await user.click(renameButton());
  await user.type(titleInput(), " notes");
  await user.click(screen.getByRole("button", { name: "Elsewhere" }));
  await settle();
  assertEqual(renamed, ["Standup notes"]);
});

test(1, "blank or unchanged titles don't call onRename", async () => {
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

test(1, "focus returns to the Rename button afterwards", async () => {
  render(<InlineTitle title="Standup" onRename={() => {}} />);
  await user.click(renameButton());
  await user.type(titleInput(), "!{Enter}");
  await settle();
  assert(document.activeElement === renameButton(), "focus was lost - it's on <" +
    (document.activeElement?.tagName.toLowerCase() ?? "nothing") + ">");
});
