// Tests for 15b - TS Warm-up 2: Unions and Narrowing.

const EVENTS = [
  { kind: "renamed" as const, noteId: "n1", at: "2026-10-01T10:00:00Z", from: "Standup", to: "Daily standup" },
  { kind: "created" as const, noteId: "n1", at: "2026-10-01T09:00:00Z", title: "Standup" },
  { kind: "created" as const, noteId: "n2", at: "2026-10-01T09:05:00Z", title: "Retro" },
  { kind: "shared" as const, noteId: "n2", at: "2026-10-01T09:10:00Z", with: ["fig@acme.com"] },
  { kind: "deleted" as const, noteId: "n2", at: "2026-10-01T11:00:00Z" },
  { kind: "created" as const, noteId: "n3", at: "2026-10-01T12:00:00Z", title: "1:1" },
  { kind: "renamed" as const, noteId: "n1", at: "2026-10-01T13:00:00Z", from: "Daily standup", to: "Standup (daily)" },
];

test(1, "describe each kind of event", () => {
  assertEqual(EVENTS.slice(0, 5).map((e) => describe(e)), [
    'Renamed "Standup" to "Daily standup"', 'Created "Standup"', 'Created "Retro"', "Shared with fig@acme.com", "Deleted",
  ]);
  assertEqual(describe({ kind: "shared", noteId: "n", at: "", with: ["a", "b", "c"] }), "Shared with 3 people");
});

test(1, "currentTitles replays in time order and drops deleted notes", () => {
  assertEqual(currentTitles(EVENTS), new Map([["n1", "Standup (daily)"], ["n3", "1:1"]]));
  assertEqual(EVENTS[0].kind, "renamed", "don't sort the caller's array");
});

test(1, "parseDuration accepts the formats people type", () => {
  const cases: [string | number, number | null][] = [
    [45, 45], [0, 0], ["45", 45], ["45m", 45], ["1h", 60], ["1h30m", 90], ["1h 30m", 90], ["  2H15M ", 135],
  ];
  for (const [input, want] of cases) assertEqual(parseDuration(input), want, JSON.stringify(input));
});

test(1, "parseDuration rejects the rest", () => {
  for (const input of [-5, NaN, Infinity, "", "abc", "1.5h", "h", "m", "30s", "1h30", "-10"]) {
    assertEqual(parseDuration(input), null, JSON.stringify(input));
  }
});

