// Tests for 17a - React 1: Render a List.

import { MeetingList } from "./your_code";
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
