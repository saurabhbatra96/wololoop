// 15 - TypeScript Warm-up: Meeting Data

interface Meeting {
  id: string;
  title: string;
  start: string; // ISO 8601, UTC
  durationMinutes: number;
  owner: string;
  attendees: string[];
}

function upcoming(meetings: readonly Meeting[], now: string): Meeting[] {
  throw new NotImplementedError("upcoming");
}

function minutesByOwner(meetings: readonly Meeting[]): Record<string, number> {
  throw new NotImplementedError("minutesByOwner");
}

function uniqueAttendees(meetings: readonly Meeting[]): string[] {
  throw new NotImplementedError("uniqueAttendees");
}

function busiestDay(meetings: readonly Meeting[]): string | null {
  throw new NotImplementedError("busiestDay");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const meetings: Meeting[] = [
    { id: "m1", title: "Standup", start: "2026-10-01T09:30:00Z", durationMinutes: 15,
      owner: "oat@granola.ai", attendees: ["Oat@granola.ai", "raisin@granola.ai"] },
  ];
  console.log(upcoming(meetings, "2026-10-01T00:00:00Z"));
});
