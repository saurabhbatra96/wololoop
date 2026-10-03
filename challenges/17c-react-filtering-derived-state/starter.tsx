// 17c - React 3: Filtering Without Extra State
//
// The list and selection already work (the previous problem's answer). The TODOs are what's new.

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
        <li key={m.id} aria-current={m.id === selectedId ? "true" : undefined}>
          <button type="button" onClick={() => onSelect?.(m.id)}>{m.title}</button>
          <span>{plural(m.attendees.length, "attendee")}</span>
          {m.hasNotes && <span>Notes</span>}
        </li>
      ))}
    </ul>
  );
}

export default function App({ meetings }: { meetings: Meeting[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  // TODO: a `query` state for the search box
  // TODO: compute the filtered meetings here, from `meetings` and `query` - not in state, not in an effect
  const visible = meetings;

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <nav>
        {/* TODO: an <input> labelled "Search" */}
        {/* TODO: "Showing 2 of 5" */}
        {/* TODO: no matches -> No meetings match "<query>" instead of the list */}
        <MeetingList meetings={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </nav>
      <main>
        {selected ? (
          <>
            <h2>{selected.title}</h2>
            <ul>
              {selected.attendees.map((email) => <li key={email}>{email}</li>)}
            </ul>
          </>
        ) : (
          <p>Select a meeting</p>
        )}
      </main>
    </div>
  );
}

const demo: Meeting[] = [
  { id: "m2", title: "Design review", startsAt: "2026-10-01T14:00:00Z", attendees: ["raisin@granola.ai", "oat@granola.ai"], hasNotes: false },
  { id: "m1", title: "Standup", startsAt: "2026-10-01T09:30:00Z", attendees: ["oat@granola.ai"], hasNotes: true },
];

preview(() => <App meetings={demo} />);
