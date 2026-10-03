// Tests for 15a - TS Warm-up 1: Arrays and Objects.

function mtg(id: string, title: string, start: string, durationMinutes: number, owner = "oat@granola.ai",
             attendees: string[] = []) {
  return { id, title, start, durationMinutes, owner, attendees };
}

const WEEK = Object.freeze([
  mtg("a", "Standup", "2026-10-01T09:30:00Z", 15, "oat@granola.ai", ["Oat@granola.ai", "raisin@granola.ai"]),
  mtg("b", "Design review", "2026-10-01T14:00:00Z", 60, "raisin@granola.ai", ["OAT@granola.ai", "fig@acme.com"]),
  mtg("c", "Retro", "2026-09-30T16:00:00Z", 45, "oat@granola.ai"),
  mtg("d", "All hands", "2026-10-02T09:30:00Z", 90, "fig@acme.com", ["date@acme.com"]),
  mtg("e", "Coffee", "2026-10-01T14:00:00Z", 15, "raisin@granola.ai"),
].map((m) => Object.freeze({ ...m, attendees: Object.freeze(m.attendees) as unknown as string[] })));

test(1, "upcoming: from now on, earliest first, title breaks ties", () => {
  assertEqual(upcoming(WEEK, "2026-10-01T09:30:00Z").map((m) => m.id), ["a", "e", "b", "d"]);
  assertEqual(upcoming(WEEK, "2026-10-03T00:00:00Z"), []);
});

test(1, "upcoming leaves its input alone", () => {
  const input = [...WEEK];
  upcoming(input, "2026-01-01T00:00:00Z");
  assertEqual(input.map((m) => m.id), ["a", "b", "c", "d", "e"]);
});

test(1, "minutesByOwner totals per owner", () => {
  assertEqual(minutesByOwner(WEEK), { "oat@granola.ai": 60, "raisin@granola.ai": 75, "fig@acme.com": 90 });
  assertEqual(minutesByOwner([]), {});
});

test(1, "uniqueAttendees: lower-cased, once each, sorted", () => {
  assertEqual(uniqueAttendees(WEEK), ["date@acme.com", "fig@acme.com", "oat@granola.ai", "raisin@granola.ai"]);
});

test(1, "busiestDay by total minutes, earliest on a tie", () => {
  assertEqual(busiestDay(WEEK), "2026-10-01"); // 90 on the 1st and the 2nd - the 1st wins
  assertEqual(busiestDay([mtg("x", "Long", "2026-10-05T10:00:00Z", 120), ...WEEK]), "2026-10-05");
  assertEqual(busiestDay([]), null);
});

