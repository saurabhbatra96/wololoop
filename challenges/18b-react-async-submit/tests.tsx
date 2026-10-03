// Tests for 18b - React 5: Async Saving.

import { NoteForm } from "./your_code";
const titleBox = () => screen.getByLabelText("Title") as HTMLInputElement;
const bodyBox = () => screen.getByLabelText("Body") as HTMLTextAreaElement;
const saveButton = () => screen.getByRole("button", { name: /^(Save|Saving…)$/ }) as HTMLButtonElement;

test(1, "while saving: Saving… and disabled", async () => {
  const save = createDeferred();
  render(<NoteForm onSubmit={() => save.promise} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  assertEqual([saveButton().textContent, saveButton().disabled], ["Saving…", true]);
  save.resolve();
  await settle();
  assertEqual(saveButton().textContent, "Save");
});

test(1, "no double submit while a save is in flight", async () => {
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

test(1, "success clears the form and says Saved until you type", async () => {
  render(<NoteForm onSubmit={async () => {}} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  await screen.findByText("Saved");
  assertEqual(titleBox().value, "");
  await user.type(titleBox(), "N");
  assertEqual(screen.queryByText("Saved"), null);
});

test(1, "failure keeps the input and shows the error", async () => {
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

test(1, "a non-Error failure gets a generic message", async () => {
  render(<NoteForm onSubmit={() => Promise.reject("500")} />);
  await user.type(titleBox(), "Standup");
  await user.click(saveButton());
  assertEqual((await screen.findByRole("alert")).textContent, "Something went wrong");
});
