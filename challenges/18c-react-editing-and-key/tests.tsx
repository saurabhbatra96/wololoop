// Tests for 18c - React 6: Editing, and Switching Notes.

import { NoteForm, NoteEditor } from "./your_code";
const titleBox = () => screen.getByLabelText("Title") as HTMLInputElement;
const bodyBox = () => screen.getByLabelText("Body") as HTMLTextAreaElement;
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving…)$/ }) as HTMLButtonElement;

const NOTES = [
  { id: "n1", title: "Standup", body: "Blocked on review" },
  { id: "n2", title: "Retro", body: "More snacks" },
];

test(1, "starts from initial; Save waits for a real change", async () => {
  render(<NoteForm initial={NOTES[0]} onSubmit={async () => {}} />);
  assertEqual([titleBox().value, bodyBox().value], ["Standup", "Blocked on review"]);
  assertEqual(saveButton().disabled, true, "nothing changed yet");
  await user.type(bodyBox(), "!");
  assertEqual(saveButton().disabled, false);
  await user.type(bodyBox(), "{Backspace}");
  assertEqual(saveButton().disabled, true, "changed back to the original");
});

test(1, "after saving an edit, the saved values stay and become the baseline", async () => {
  const saved: unknown[] = [];
  render(<NoteForm initial={NOTES[0]} onSubmit={async (d) => { saved.push(d); }} />);
  await user.type(titleBox(), " (daily) ");
  await user.click(saveButton());
  await screen.findByText("Saved");
  assertEqual(saved, [{ title: "Standup (daily)", body: "Blocked on review" }]);
  assertEqual([titleBox().value, saveButton().disabled], ["Standup (daily)", true]);
});

test(1, "Cancel restores initial and reports it", async () => {
  let cancelled = 0;
  render(<NoteForm initial={NOTES[0]} onSubmit={async () => {}} onCancel={() => { cancelled++; }} />);
  await user.clear(titleBox());
  await user.type(titleBox(), "Something else");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  assertEqual([titleBox().value, cancelled], ["Standup", 1]);
});

test(1, "no Cancel button without onCancel", () => {
  render(<NoteForm onSubmit={async () => {}} />);
  assertEqual(screen.queryByRole("button", { name: "Cancel" }), null);
});

test(1, "NoteEditor opens the clicked note and saves by id", async () => {
  const saved: unknown[] = [];
  render(<NoteEditor notes={NOTES} onSave={async (id, d) => { saved.push([id, d]); }} />);
  assertEqual(screen.queryByLabelText("Title"), null, "no form until a note is picked");
  await user.click(screen.getByRole("button", { name: "Retro" }));
  assertEqual(titleBox().value, "Retro");
  await user.type(bodyBox(), " and fruit");
  await user.click(saveButton());
  await settle();
  assertEqual(saved, [["n2", { title: "Retro", body: "More snacks and fruit" }]]);
});

test(1, "switching notes never shows the previous note's draft", async () => {
  render(<NoteEditor notes={NOTES} onSave={async () => {}} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  await user.type(titleBox(), " DRAFT");
  await user.click(screen.getByRole("button", { name: "Retro" }));
  assertEqual([titleBox().value, bodyBox().value], ["Retro", "More snacks"]);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  assertEqual(titleBox().value, "Standup", "an unsaved draft is discarded, not resurrected");
});
