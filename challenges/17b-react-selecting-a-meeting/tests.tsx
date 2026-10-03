// Tests for 17b - React 2: Selecting a Meeting.

import App, { MeetingList } from "./your_code";
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

test(1, "titles are buttons that report the id", async () => {
  const clicked: string[] = [];
  render(<MeetingList meetings={[...MEETINGS]} onSelect={(id) => clicked.push(id)} />);
  await user.click(screen.getByRole("button", { name: "Design review" }));
  assertEqual(clicked, ["m2"]);
});

test(1, "nothing selected yet", () => {
  render(<App meetings={[...MEETINGS]} />);
  screen.getByText("Select a meeting");
  assertEqual(screen.queryAllByRole("heading").length, 0);
});

test(1, "clicking a meeting shows it on the right", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Quarterly yoghurt review" }));
  screen.getByRole("heading", { name: "Quarterly yoghurt review" });
  screen.getByText("fig@acme.com");
  assertEqual(screen.queryByText("Select a meeting"), null);
});

test(1, "the selected item is marked aria-current", async () => {
  render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  const current = document.querySelectorAll("li[aria-current='true']");
  assertEqual(current.length, 1);
  assert(current[0].textContent!.includes("Standup"), "aria-current is on the wrong item");
});

test(1, "selection follows fresh props (store the id, not the object)", async () => {
  const view = render(<App meetings={[...MEETINGS]} />);
  await user.click(screen.getByRole("button", { name: "Standup" }));
  view.rerender(<App meetings={MEETINGS.map((m) => (m.id === "m1" ? { ...m, title: "Daily standup" } : m))} />);
  screen.getByRole("heading", { name: "Daily standup" });
  view.rerender(<App meetings={MEETINGS.filter((m) => m.id !== "m1")} />);
  screen.getByText("Select a meeting");
});
