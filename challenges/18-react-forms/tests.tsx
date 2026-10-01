// Tests for 18 - Forms and Controlled Inputs.

import { NoteForm } from "./your_code";
/** @stage 3 - NoteEditor arrives in Part 3 */
import { NoteEditor } from "./your_code";

const titleBox = () => screen.getByLabelText("Title") as HTMLInputElement;
const bodyBox = () => screen.getByLabelText("Body") as HTMLTextAreaElement;
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving…)$/ }) as HTMLButtonElement;

// ------------------------------------------------------------------ part 1

test(1, "labelled, controlled fields", async () => {
  render(<NoteForm onSubmit={() => {}} />);
  await user.type(titleBox(), "Standup");
  await user.type(bodyBox(), "Blocked on review");
  assertEqual([titleBox().value, bodyBox().value], ["Standup", "Blocked on review"]);
  assert(bodyBox().tagName === "TEXTAREA", "Body should be a <textarea>");
});

test(1, "Save is disabled while the title is blank", async () => {
  render(<NoteForm onSubmit={() => {}} />);
  assertEqual(saveButton().disabled, true, "empty");
  await user.type(titleBox(), "   ");
  assertEqual(saveButton().disabled, true, "spaces only");
  await user.type(titleBox(), "x");
  assertEqual(saveButton().disabled, false);
});

test(1, "a character counter, and a cap at 80", async () => {
  render(<NoteForm onSubmit={() => {}} />);
  screen.getByText("0 / 80");
  await user.type(titleBox(), "a".repeat(80));
  screen.getByText("80 / 80");
  assertEqual([saveButton().disabled, screen.queryByText("Title is too long")], [false, null]);
  await user.type(titleBox(), "b");
  screen.getByText("81 / 80");
  screen.getByText("Title is too long");
  assertEqual(saveButton().disabled, true);
});

test(1, "clicking Save submits trimmed title, raw body, then clears", async () => {
  const submitted: unknown[] = [];
  render(<NoteForm onSubmit={(d) => { submitted.push(d); }} />);
  await user.type(titleBox(), "  Standup  ");
  await user.type(bodyBox(), "  notes  ");
  await user.click(saveButton());
  assertEqual(submitted, [{ title: "Standup", body: "  notes  " }]);
  await settle();
  assertEqual([titleBox().value, bodyBox().value], ["", ""]);
});

test(1, "Enter in the title submits, without reloading the page", async () => {
  const submitted: unknown[] = [];
  render(<NoteForm onSubmit={(d) => { submitted.push(d); }} />);
  await user.type(titleBox(), "Retro{Enter}");
  assertEqual(submitted, [{ title: "Retro", body: "" }]);
  screen.getByLabelText("Title"); // still here: the page didn't navigate away
});

test(1, "Enter on a blank title does nothing", async () => {
  const submitted: unknown[] = [];
  render(<NoteForm onSubmit={(d) => { submitted.push(d); }} />);
  await user.type(titleBox(), "  {Enter}");
  assertEqual(submitted, []);
});

// ------------------------------------------------------------------ part 2

test(2, "while saving: Saving… and disabled", async () => {
  const save = createDeferred();
  render(<NoteForm onSubmit={() => save.promise} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  assertEqual([saveButton().textContent, saveButton().disabled], ["Saving…", true]);
  save.resolve();
  await settle();
  assertEqual(saveButton().textContent, "Save");
});

test(2, "no double submit while a save is in flight", async () => {
  const save = createDeferred();
  let calls = 0;
  render(<NoteForm onSubmit={() => { calls++; return save.promise; }} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  await user.type(titleBox(), "{Enter}");
  await user.click(saveButton());
  assertEqual(calls, 1);
  save.resolve();
  await settle();
});

test(2, "success clears the form and says Saved until you type", async () => {
  render(<NoteForm onSubmit={async () => {}} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  await screen.findByText("Saved");
  assertEqual(titleBox().value, "");
  await user.type(titleBox(), "N");
  assertEqual(screen.queryByText("Saved"), null);
});

test(2, "failure keeps the input and shows the error", async () => {
  const save = createDeferred();
  render(<NoteForm onSubmit={() => save.promise} />);
  await user.type(titleBox(), "Standup");
  await user.type(bodyBox(), "draft");
  await user.click(saveButton());
  save.reject(new Error("You're offline"));
  const alert = await screen.findByRole("alert");
  assertEqual(alert.textContent, "You're offline");
  assertEqual([titleBox().value, bodyBox().value, saveButton().disabled], ["Standup", "draft", false]);
});

test(2, "a non-Error failure gets a generic message", async () => {
  render(<NoteForm onSubmit={() => Promise.reject("500")} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  assertEqual((await screen.findByRole("alert")).textContent, "Something went wrong");
});

// ------------------------------------------------------------------ part 3

const NOTES = [
  { id: "n1", title: "Standup", body: "Blocked on review" },
  { id: "n2", title: "Retro", body: "More snacks" },
];

test(3, "starts from initial; Save waits for a real change", async () => {
  render(<NoteForm initial={NOTES[0]} onSubmit={async () => {}} />);
  assertEqual([titleBox().value, bodyBox().value], ["Standup", "Blocked on review"]);
  assertEqual(saveButton().disabled, true, "nothing changed yet");
  await user.type(bodyBox(), "!");
  assertEqual(saveButton().disabled, false);
  await user.type(bodyBox(), "{Backspace}");
  assertEqual(saveButton().disabled, true, "changed back to the original");
});

test(3, "after saving an edit, the saved values stay and become the baseline", async () => {
  const saved: unknown[] = [];
  render(<NoteForm initial={NOTES[0]} onSubmit={async (d) => { saved.push(d); }} />);
  await user.type(titleBox(), " (daily) ");
  await user.click(saveButton());
  await screen.findByText("Saved");
  assertEqual(saved, [{ title: "Standup (daily)", body: "Blocked on review" }]);
  assertEqual([titleBox().value, saveButton().disabled], ["Standup (daily)", true]);
});

test(3, "Cancel restores initial and reports it", async () => {
  let cancelled = 0;
  render(<NoteForm initial={NOTES[0]} onSubmit={async () => {}} onCancel={() => { cancelled++; }} />);
  await user.clear(titleBox());
  await user.type(titleBox(), "Something else");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  assertEqual([titleBox().value, cancelled], ["Standup", 1]);
});

test(3, "no Cancel button without onCancel", () => {
  render(<NoteForm onSubmit={async () => {}} />);
  assertEqual(screen.queryByRole("button", { name: "Cancel" }), null);
});

test(3, "NoteEditor opens the clicked note and saves by id", async () => {
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

test(3, "switching notes never shows the previous note's draft", async () => {
  render(<NoteEditor notes={NOTES} onSave={async () => {}} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  await user.type(titleBox(), " DRAFT");
  await user.click(screen.getByRole("button", { name: "Retro" }));
  assertEqual([titleBox().value, bodyBox().value], ["Retro", "More snacks"]);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  assertEqual(titleBox().value, "Standup", "an unsaved draft is discarded, not resurrected");
});
