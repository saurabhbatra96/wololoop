// 15b - TS Warm-up 2: Unions and Narrowing: reference solution.

interface Meeting {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  owner: string;
  attendees: string[];
}


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
