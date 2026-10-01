// Tests for 15 - TypeScript Warm-up: Meeting Data.

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

// ------------------------------------------------------------------ part 1

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

// ------------------------------------------------------------------ part 2

const EVENTS = [
  { kind: "renamed" as const, noteId: "n1", at: "2026-10-01T10:00:00Z", from: "Standup", to: "Daily standup" },
  { kind: "created" as const, noteId: "n1", at: "2026-10-01T09:00:00Z", title: "Standup" },
  { kind: "created" as const, noteId: "n2", at: "2026-10-01T09:05:00Z", title: "Retro" },
  { kind: "shared" as const, noteId: "n2", at: "2026-10-01T09:10:00Z", with: ["fig@acme.com"] },
  { kind: "deleted" as const, noteId: "n2", at: "2026-10-01T11:00:00Z" },
  { kind: "created" as const, noteId: "n3", at: "2026-10-01T12:00:00Z", title: "1:1" },
  { kind: "renamed" as const, noteId: "n1", at: "2026-10-01T13:00:00Z", from: "Daily standup", to: "Standup (daily)" },
];

test(2, "describe each kind of event", () => {
  assertEqual(EVENTS.slice(0, 5).map((e) => describe(e)), [
    'Renamed "Standup" to "Daily standup"', 'Created "Standup"', 'Created "Retro"', "Shared with fig@acme.com", "Deleted",
  ]);
  assertEqual(describe({ kind: "shared", noteId: "n", at: "", with: ["a", "b", "c"] }), "Shared with 3 people");
});

test(2, "currentTitles replays in time order and drops deleted notes", () => {
  assertEqual(currentTitles(EVENTS), new Map([["n1", "Standup (daily)"], ["n3", "1:1"]]));
  assertEqual(EVENTS[0].kind, "renamed", "don't sort the caller's array");
});

test(2, "parseDuration accepts the formats people type", () => {
  const cases: [string | number, number | null][] = [
    [45, 45], [0, 0], ["45", 45], ["45m", 45], ["1h", 60], ["1h30m", 90], ["1h 30m", 90], ["  2H15M ", 135],
  ];
  for (const [input, want] of cases) assertEqual(parseDuration(input), want, JSON.stringify(input));
});

test(2, "parseDuration rejects the rest", () => {
  for (const input of [-5, NaN, Infinity, "", "abc", "1.5h", "h", "m", "30s", "1h30", "-10"]) {
    assertEqual(parseDuration(input), null, JSON.stringify(input));
  }
});

// ------------------------------------------------------------------ part 3

test(3, "groupBy keeps order within groups", () => {
  const byOwner = groupBy(WEEK, (m) => m.owner);
  assertEqual(byOwner["oat@granola.ai"]?.map((m) => m.id), ["a", "c"]);
  assertEqual(Object.keys(byOwner).sort(), ["fig@acme.com", "oat@granola.ai", "raisin@granola.ai"]);
});

test(3, "groupBy's type knows the keys, and that a group may be missing", () => {
  const parity = groupBy([1, 3, 5], (n) => (n % 2 === 0 ? "even" : "odd"));
  const odd: number[] | undefined = parity.odd;
  assertEqual([odd, parity.even], [[1, 3, 5], undefined]);
  // @ts-expect-error - a group can be missing, so it's not number[]
  const even: number[] = parity.even;
  // @ts-expect-error - "prime" is not a possible key
  parity.prime;
  void even;
});

test(3, "pick copies just those keys, and its type says so", () => {
  const picked = pick(WEEK[0], ["id", "title"]);
  assertEqual(picked, { id: "a", title: "Standup" });
  const title: string = picked.title;
  // @ts-expect-error - start wasn't picked
  picked.start;
  // @ts-expect-error - not a key of Meeting
  pick(WEEK[0], ["colour"]);
  void title;
});

test(3, "updateMeeting is immutable and ignores undefined", () => {
  const before = WEEK[1];
  const after = updateMeeting(before, { title: "Design crit", durationMinutes: undefined });
  assertEqual([after.title, after.durationMinutes, after.id], ["Design crit", 60, "b"]);
  assertEqual(before.title, "Design review");
  assert(after !== before, "return a new object");
  // @ts-expect-error - the id can't be patched
  updateMeeting(before, { id: "z" });
});

test(3, "sortBy: several keys, stable for full ties", () => {
  const sorted = sortBy(WEEK, (m) => m.owner, (m) => -m.durationMinutes);
  assertEqual(sorted.map((m) => m.id), ["d", "c", "a", "b", "e"]);
  const byDayOnly = sortBy(WEEK, (m) => m.start.slice(0, 10));
  assertEqual(byDayOnly.map((m) => m.id), ["c", "a", "b", "e", "d"], "ties keep input order");
  assertEqual(WEEK.map((m) => m.id), ["a", "b", "c", "d", "e"]);
});
