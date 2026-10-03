// 15c - TS Warm-up 3: Generics and Utility Types
//
// The signatures are the exercise as much as the bodies - leave them as they are
// and fill in the bodies. The tests check the types too (with @ts-expect-error).

interface Meeting {
  id: string;
  title: string;
  start: string; // ISO 8601, UTC
  durationMinutes: number;
  owner: string;
  attendees: string[];
}

/** Items grouped by key(item), keeping their original order within each group. */
function groupBy<T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): Partial<Record<K, T[]>> {
  throw new NotImplementedError("groupBy");
}

/** A new object with only these keys - and a type that only has these keys. */
function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  throw new NotImplementedError("pick");
}

/** A new meeting with the patch applied. Keys set to undefined in the patch are ignored. */
function updateMeeting(meeting: Meeting, patch: Partial<Omit<Meeting, "id">>): Meeting {
  throw new NotImplementedError("updateMeeting");
}

/** A sorted copy: by the first key, then the next to break ties; full ties keep input order. */
function sortBy<T>(items: readonly T[], ...keys: ((item: T) => string | number)[]): T[] {
  throw new NotImplementedError("sortBy");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  console.log(groupBy([1, 2, 3, 4, 5], (n) => (n % 2 === 0 ? "even" : "odd")));
  console.log(pick({ id: "m1", title: "Standup", owner: "oat@granola.ai" }, ["id", "title"]));
  console.log(sortBy([{ n: "b", v: 2 }, { n: "a", v: 2 }, { n: "c", v: 1 }], (x) => x.v, (x) => x.n));
});
