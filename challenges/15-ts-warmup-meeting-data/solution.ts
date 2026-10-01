// 15 - TypeScript Warm-up: Meeting Data - reference solution, all three parts.

interface Meeting {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  owner: string;
  attendees: string[];
}

// ------------------------------------------------------------------ part 1

function upcoming(meetings: readonly Meeting[], now: string): Meeting[] {
  return meetings
    .filter((m) => m.start >= now) // same-format ISO strings compare correctly as text
    .sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
}

function minutesByOwner(meetings: readonly Meeting[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of meetings) totals[m.owner] = (totals[m.owner] ?? 0) + m.durationMinutes;
  return totals;
}

function uniqueAttendees(meetings: readonly Meeting[]): string[] {
  const emails = new Set(meetings.flatMap((m) => m.attendees.map((a) => a.toLowerCase())));
  return [...emails].sort();
}

function busiestDay(meetings: readonly Meeting[]): string | null {
  const byDay = new Map<string, number>();
  for (const m of meetings) {
    const day = m.start.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + m.durationMinutes);
  }
  let best: string | null = null;
  for (const [day, minutes] of byDay) {
    const bestMinutes = best === null ? -1 : byDay.get(best)!;
    if (minutes > bestMinutes || (minutes === bestMinutes && day < best!)) best = day;
  }
  return best;
}

// ------------------------------------------------------------------ part 2

type NoteEvent =
  | { kind: "created"; noteId: string; at: string; title: string }
  | { kind: "renamed"; noteId: string; at: string; from: string; to: string }
  | { kind: "shared"; noteId: string; at: string; with: string[] }
  | { kind: "deleted"; noteId: string; at: string };

function describe(event: NoteEvent): string {
  switch (event.kind) {
    case "created":
      return `Created "${event.title}"`;
    case "renamed":
      return `Renamed "${event.from}" to "${event.to}"`;
    case "shared":
      return event.with.length === 1 ? `Shared with ${event.with[0]}` : `Shared with ${event.with.length} people`;
    case "deleted":
      return "Deleted";
    default: {
      const unreachable: never = event;
      throw new Error("unknown event " + JSON.stringify(unreachable));
    }
  }
}

function currentTitles(events: readonly NoteEvent[]): Map<string, string> {
  const titles = new Map<string, string>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) {
    if (e.kind === "created") titles.set(e.noteId, e.title);
    else if (e.kind === "renamed") titles.set(e.noteId, e.to);
    else if (e.kind === "deleted") titles.delete(e.noteId);
  }
  return titles;
}

function parseDuration(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? input : null;
  const m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m?)?$/i.exec(input.trim());
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  // "1h30" is ambiguous - only accept bare digits when there are no hours
  if (m[1] !== undefined && m[2] !== undefined && !/m$/i.test(input.trim())) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

// ------------------------------------------------------------------ part 3

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

main(() => {
  const meetings: Meeting[] = [
    { id: "m1", title: "Standup", start: "2026-10-01T09:30:00Z", durationMinutes: 15,
      owner: "oat@granola.ai", attendees: ["Oat@granola.ai", "raisin@granola.ai"] },
  ];
  console.log(upcoming(meetings, "2026-10-01T00:00:00Z"));
});
