// 15a - TS Warm-up 1: Arrays and Objects
//
// Fill in the four function bodies. Nothing here should mutate its input.

interface Meeting {
  id: string;
  title: string;
  start: string; // ISO 8601 in UTC, e.g. "2026-10-01T09:30:00Z"
  durationMinutes: number;
  owner: string; // email
  attendees: string[]; // emails, any case
}

/** Meetings starting at or after `now`, earliest first; same start -> title A-Z. */
function upcoming(meetings: readonly Meeting[], now: string): Meeting[] {
  throw new NotImplementedError("upcoming");
}

/** Total minutes per owner email, e.g. { "oat@granola.ai": 60 }. */
function minutesByOwner(meetings: readonly Meeting[]): Record<string, number> {
  throw new NotImplementedError("minutesByOwner");
}

/** Every attendee once, lower-cased, sorted A-Z. */
function uniqueAttendees(meetings: readonly Meeting[]): string[] {
  throw new NotImplementedError("uniqueAttendees");
}

/** The UTC day ("2026-10-01") with the most total minutes; earliest day on a tie; null if none. */
function busiestDay(meetings: readonly Meeting[]): string | null {
  throw new NotImplementedError("busiestDay");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const meetings: Meeting[] = [
    { id: "m1", title: "Standup", start: "2026-10-01T09:30:00Z", durationMinutes: 15,
      owner: "oat@granola.ai", attendees: ["Oat@granola.ai", "raisin@granola.ai"] },
    { id: "m2", title: "Retro", start: "2026-10-02T16:00:00Z", durationMinutes: 45,
      owner: "raisin@granola.ai", attendees: ["fig@acme.com"] },
  ];
  console.log(upcoming(meetings, "2026-10-01T00:00:00Z").map((m) => m.title));
  console.log(minutesByOwner(meetings));
  console.log(uniqueAttendees(meetings));
  console.log(busiestDay(meetings));
});
