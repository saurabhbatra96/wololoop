// 17a - React 1: Render a List
//
// Fill in MeetingList. Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

export interface Meeting {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  attendees: string[]; // emails
  hasNotes: boolean;
}

/** "1 attendee", "3 attendees" */
const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  // TODO: no meetings -> <p>No meetings yet</p>
  // TODO: otherwise a <ul> with one <li key={...}> per meeting, earliest first (sort a copy!),
  //       each with the title, the attendee count, and a "Notes" badge only when hasNotes
  return <p>TODO</p>;
}

const demo: Meeting[] = [
  { id: "m2", title: "Design review", startsAt: "2026-10-01T14:00:00Z", attendees: ["raisin@granola.ai", "oat@granola.ai"], hasNotes: false },
  { id: "m1", title: "Standup", startsAt: "2026-10-01T09:30:00Z", attendees: ["oat@granola.ai"], hasNotes: true },
];

preview(() => <MeetingList meetings={demo} />);
