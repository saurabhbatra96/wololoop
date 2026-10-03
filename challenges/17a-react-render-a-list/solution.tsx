// 17a - React 1: Render a List: reference solution.

export interface Meeting {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  attendees: string[]; // emails
  hasNotes: boolean;
}

const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  if (meetings.length === 0) return <p>No meetings yet</p>;

  // Copy first: sort() reorders in place, and these are the parent's props.
  const sorted = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <ul>
      {sorted.map((m) => (
        <li key={m.id}>
          <strong>{m.title}</strong>
          <span>{plural(m.attendees.length, "attendee")}</span>
          {m.hasNotes && <span>Notes</span>}
        </li>
      ))}
    </ul>
  );
}

const demo: Meeting[] = [
  { id: "m2", title: "Design review", startsAt: "2026-10-01T14:00:00Z", attendees: ["raisin@granola.ai", "oat@granola.ai"], hasNotes: false },
  { id: "m1", title: "Standup", startsAt: "2026-10-01T09:30:00Z", attendees: ["oat@granola.ai"], hasNotes: true },
];

preview(() => <MeetingList meetings={demo} />);
