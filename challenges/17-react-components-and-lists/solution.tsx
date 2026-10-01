// 17 - Components, Props and Lists: reference solution, all three parts.

import { useState } from "react";

export interface Meeting {
  id: string;
  title: string;
  startsAt: string;
  attendees: string[];
  hasNotes: boolean;
}

const plural = (n: number, word: string) => n + " " + word + (n === 1 ? "" : "s");

export function MeetingList({ meetings, selectedId = null, onSelect }: {
  meetings: Meeting[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  if (meetings.length === 0) return <p>No meetings yet</p>;

  // Copy first: sort() reorders in place, and these are the parent's props.
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

function matches(m: Meeting, query: string): boolean {
  const q = query.toLowerCase();
  return m.title.toLowerCase().includes(q) || m.attendees.some((a) => a.toLowerCase().includes(q));
}

export default function App({ meetings }: { meetings: Meeting[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Derived, not stored: always in step with the latest props.
  const q = query.trim();
  const visible = q ? meetings.filter((m) => matches(m, q)) : meetings;
  const selected = meetings.find((m) => m.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", gap: 24 }}>
      <nav>
        <label>
          Search <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <p>Showing {visible.length} of {meetings.length}</p>
        {q && visible.length === 0
          ? <p>No meetings match "{q}"</p>
          : <MeetingList meetings={visible} selectedId={selectedId} onSelect={setSelectedId} />}
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
