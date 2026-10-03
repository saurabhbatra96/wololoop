// Tests for 15c - TS Warm-up 3: Generics and Utility Types.

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

test(1, "groupBy keeps order within groups", () => {
  const byOwner = groupBy(WEEK, (m) => m.owner);
  assertEqual(byOwner["oat@granola.ai"]?.map((m) => m.id), ["a", "c"]);
  assertEqual(Object.keys(byOwner).sort(), ["fig@acme.com", "oat@granola.ai", "raisin@granola.ai"]);
});

test(1, "groupBy's type knows the keys, and that a group may be missing", () => {
  const parity = groupBy([1, 3, 5], (n) => (n % 2 === 0 ? "even" : "odd"));
  const odd: number[] | undefined = parity.odd;
  assertEqual([odd, parity.even], [[1, 3, 5], undefined]);
  // @ts-expect-error - a group can be missing, so it's not number[]
  const even: number[] = parity.even;
  // @ts-expect-error - "prime" is not a possible key
  parity.prime;
  void even;
});

test(1, "pick copies just those keys, and its type says so", () => {
  const picked = pick(WEEK[0], ["id", "title"]);
  assertEqual(picked, { id: "a", title: "Standup" });
  const title: string = picked.title;
  // @ts-expect-error - start wasn't picked
  picked.start;
  // @ts-expect-error - not a key of Meeting
  pick(WEEK[0], ["colour"]);
  void title;
});

test(1, "updateMeeting is immutable and ignores undefined", () => {
  const before = WEEK[1];
  const after = updateMeeting(before, { title: "Design crit", durationMinutes: undefined });
  assertEqual([after.title, after.durationMinutes, after.id], ["Design crit", 60, "b"]);
  assertEqual(before.title, "Design review");
  assert(after !== before, "return a new object");
  // @ts-expect-error - the id can't be patched
  updateMeeting(before, { id: "z" });
});

test(1, "sortBy: several keys, stable for full ties", () => {
  const sorted = sortBy(WEEK, (m) => m.owner, (m) => -m.durationMinutes);
  assertEqual(sorted.map((m) => m.id), ["d", "c", "a", "b", "e"]);
  const byDayOnly = sortBy(WEEK, (m) => m.start.slice(0, 10));
  assertEqual(byDayOnly.map((m) => m.id), ["c", "a", "b", "e", "d"], "ties keep input order");
  assertEqual(WEEK.map((m) => m.id), ["a", "b", "c", "d", "e"]);
});
