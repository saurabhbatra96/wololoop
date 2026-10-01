// Tests for 17 - Components, Props and Lists.

import { MeetingList } from "./your_code";
/** @stage 2 - App arrives in Part 2 */
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


// ------------------------------------------------------------------ part 1

// First on purpose: React only warns about a missing key once per page.
test(1, "every item has a key (React stays quiet)", () => {
  const errors = consoleErrorsDuring(() => render(<MeetingList meetings={[...MEETINGS]} />));
  const keyWarnings = errors.filter((e) => /unique "key"/.test(e));
  assertEqual(keyWarnings, [], "React warned about keys");
});

test(1, "one list item per meeting, earliest first", () => {
  render(<MeetingList meetings={[...MEETINGS]} />);
  const items = screen.getAllByRole("listitem");
  assertEqual(items.length, 3);
  assertEqual(items.map((li) => ["Standup", "Design review", "Quarterly yoghurt review"].find((t) => li.textContent!.includes(t))),
              ["Standup", "Design review", "Quarterly yoghurt review"]);
});

test(1, "sorts a copy, never the props", () => {
  render(<MeetingList meetings={MEETINGS as never} />); // frozen: sorting it in place throws
  assertEqual(MEETINGS.map((m) => m.id), ["m3", "m1", "m2"]);
});

test(1, "attendee counts are pluralised", () => {
  render(<MeetingList meetings={[...MEETINGS]} />);
  screen.getByText("3 attendees");
  screen.getByText("2 attendees");
  screen.getByText("1 attendee");
});

test(1, "the Notes badge only shows when there are notes", () => {
  render(<MeetingList meetings={[...MEETINGS]} />);
  const badges = screen.getAllByText("Notes");
  assertEqual(badges.length, 1);
  assert(badges[0].closest("li")!.textContent!.includes("Quarterly yoghurt review"), "badge is on the wrong meeting");
});

test(1, "an empty list says so", () => {
  render(<MeetingList meetings={[]} />);
  screen.getByText("No meetings yet");
  assertEqual(screen.queryAllByRole("listitem").length, 0);
  assertEqual(screen.queryAllByRole("list").length, 0, "don't render an empty <ul>");
});

// ------------------------------------------------------------------ part 2

test(2, "titles are buttons that report the id", async () => {
  const clicked: string[] = [];
  render(<MeetingList meetings={[...MEETINGS]} onSelect={(id) => clicked.push(id)} />);
  await user.click(screen.getByRole("button", { name: "Design review" }));
  assertEqual(clicked, ["m2"]);
});

test(2, "nothing selected yet", () => {
  render(<App meetings={[...MEETINGS]} />);
  screen.getByText("Select a meeting");
  assertEqual(screen.queryAllByRole("heading").length, 0);
});

test(2, "clicking a meeting shows it on the right", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Quarterly yoghurt review" }));
  screen.getByRole("heading", { name: "Quarterly yoghurt review" });
  screen.getByText("fig@acme.com");
  assertEqual(screen.queryByText("Select a meeting"), null);
});

test(2, "the selected item is marked aria-current", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  const current = document.querySelectorAll("li[aria-current='true']");
  assertEqual(current.length, 1);
  assert(current[0].textContent!.includes("Standup"), "aria-current is on the wrong item");
});

test(2, "selection follows fresh props (store the id, not the object)", async () => {
  const view = render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  view.rerender(<App meetings={MEETINGS.map((m) => (m.id === "m1" ? { ...m, title: "Daily standup" } : m))} />);
  screen.getByRole("heading", { name: "Daily standup" });
  view.rerender(<App meetings={MEETINGS.filter((m) => m.id !== "m1")} />);
  screen.getByText("Select a meeting");
});

// ------------------------------------------------------------------ part 3

const search = () => screen.getByLabelText(/search/i);

test(3, "a labelled search box, and a count", () => {
  render(<App meetings={[...MEETINGS]} />);
  assertEqual((search() as HTMLInputElement).value, "");
  screen.getByText("Showing 3 of 3");
});

test(3, "filters by title, case-insensitively", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "REVIEW");
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Design review", "Quarterly yoghurt review"]);
  screen.getByText("Showing 2 of 3");
});

test(3, "filters by attendee email too, ignoring surrounding spaces", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "  acme ");
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Quarterly yoghurt review"]);
});

test(3, "no matches says what didn't match", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), " retro ");
  screen.getByText('No meetings match "retro"');
  screen.getByText("Showing 0 of 3");
  assertEqual(screen.queryAllByRole("button").length, 0);
});

test(3, "the filter stays in step when props change", async () => {
  const view = render(<App meetings={[...MEETINGS]} />);
  await user.type(search(), "review");
  view.rerender(<App meetings={[...MEETINGS, meeting("m4", "Hiring review", "2026-10-01T08:00:00Z")]} />);
  assertEqual(screen.getAllByRole("button").map((b) => b.textContent), ["Hiring review", "Design review", "Quarterly yoghurt review"]);
  screen.getByText("Showing 3 of 4");
});

test(3, "the selection survives being filtered out", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  await user.type(search(), "yoghurt");
  screen.getByRole("heading", { name: "Standup" });
});
