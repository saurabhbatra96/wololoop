// Tests for 18a - React 4: A Controlled Form.

import { NoteForm } from "./your_code";
const titleBox = () => screen.getByLabelText("Title") as HTMLInputElement;
const bodyBox = () => screen.getByLabelText("Body") as HTMLTextAreaElement;
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving…)$/ }) as HTMLButtonElement;

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
