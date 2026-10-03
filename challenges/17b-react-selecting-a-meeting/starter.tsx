// 17b - React 2: Selecting a Meeting
//
// MeetingList already works (it's the previous problem's answer). The TODOs are what's new.

import { useState } from "react";

export interface Meeting {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  attendees: string[]; // emails
  hasNotes: boolean;
}

const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");

export function MeetingList({ meetings, selectedId = null, onSelect }: {
  meetings: Meeting[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (meetings.length === 0) return <p>No meetings yet</p>;

  const sorted = [...meetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return (
    <ul>
      {sorted.map((m) => (
        // TODO: aria-current="true" on the selected meeting's <li>
        <li key={m.id}>
          {/* TODO: make the title a <button> that calls onSelect(m.id) */}
          <strong>{m.title}</strong>
          <span>{plural(m.attendees.length, "attendee")}</span>
          {m.hasNotes && <span>Notes</span>}
        </li>
      ))}
    </ul>
  );
}

export default function App({ meetings }: { meetings: Meeting[] }) {
  // TODO: keep the selected meeting's *id* in state (useState<string | null>),
  //       and find the meeting from `meetings` while rendering
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <nav>
        <MeetingList meetings={meetings} />
      </nav>
      <main>
        {/* TODO: "Select a meeting", or the selected meeting's <h2> title and a list of its attendees */}
      </main>
    </div>
  );
}

const demo: Meeting[] = [
  { id: "m2", title: "Design review", startsAt: "2026-10-01T14:00:00Z", attendees: ["raisin@granola.ai", "oat@granola.ai"], hasNotes: false },
  { id: "m1", title: "Standup", startsAt: "2026-10-01T09:30:00Z", attendees: ["oat@granola.ai"], hasNotes: true },
];

preview(() => <App meetings={demo} />);
