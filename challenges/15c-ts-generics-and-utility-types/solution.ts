// 15c - TS Warm-up 3: Generics and Utility Types: reference solution.

interface Meeting {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  owner: string;
  attendees: string[];
}


function groupBy<T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): Partial<Record<K, T[]>> {
  const groups: Partial<Record<K, T[]>> = {};
  for (const item of items) (groups[key(item)] ??= []).push(item);
  return groups;
}

function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

function updateMeeting(meeting: Meeting, patch: Partial<Omit<Meeting, "id">>): Meeting {
  const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  return { ...meeting, ...defined };
}

function sortBy<T>(items: readonly T[], ...keys: ((item: T) => string | number)[]): T[] {
  return [...items].sort((a, b) => {
    for (const key of keys) {
      const x = key(a), y = key(b);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  });
}
