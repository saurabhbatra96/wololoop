// 15a - TS Warm-up 1: Arrays and Objects: reference solution.

interface Meeting {
  id: string;
  title: string;
  start: string;
  durationMinutes: number;
  owner: string;
  attendees: string[];
}


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
