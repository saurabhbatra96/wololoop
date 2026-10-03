// Tests for 17c - React 3: Filtering Without Extra State.

import App from "./your_code";
function meeting(id: string, title: string, startsAt: string, attendees: string[] = ["oat@granola.ai"], hasNotes = false) {
  return { id, title, startsAt, attendees, hasNotes };
}

const MEETINGS = Object.freeze([
  meeting("m3", "Quarterly yoghurt review", "2026-10-01T16:00:00Z", ["oat@granola.ai", "raisin@granola.ai", "fig@acme.com"], true),
  meeting("m1", "Standup", "2026-10-01T09:30:00Z"),
  meeting("m2", "Design review", "2026-10-01T14:00:00Z", ["raisin@granola.ai", "oat@granola.ai"]),
]);

/** console.error calls made while fn runs - React reports missing keys that way. */
function consoleErrorsDuring(fn: () => void): string[] {
  const seen: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { seen.push(args.map(String).join(" ")); };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return seen;
}

const search = () => screen.getByLabelText(/search/i);

test(1, "a labelled search box, and a count", () => {
  render(<App meetings={[...MEETINGS]} />);
  assertEqual((search() as HTMLInputElement).value, "");
  screen.getByText("Showing 3 of 3");
});

test(1, "filters by title, case-insensitively", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "REVIEW");
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Design review", "Quarterly yoghurt review"]);
  screen.getByText("Showing 2 of 3");
});

test(1, "filters by attendee email too, ignoring surrounding spaces", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "  acme ");
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Quarterly yoghurt review"]);
});

test(1, "no matches says what didn't match", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), " retro ");
  screen.getByText('No meetings match "retro"');
  screen.getByText("Showing 0 of 3");
  assertEqual(screen.queryAllByRole("button").length, 0);
});

test(1, "the filter stays in step when props change", async () => {
  const view = render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "review");
  view.rerender(<App meetings={[...MEETINGS, meeting("m4", "Hiring review", "2026-10-01T08:00:00Z")]} />);
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Hiring review", "Design review", "Quarterly yoghurt review"]);
  screen.getByText("Showing 3 of 4");
});

test(1, "the selection survives being filtered out", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  await user.type(search(), "yoghurt");
  screen.getByRole("heading", { name: "Standup" });
});
