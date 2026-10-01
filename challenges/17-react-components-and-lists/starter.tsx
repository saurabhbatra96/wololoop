// 17 - Components, Props and Lists
//
// Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { useState } from "react";

export interface Meeting {
  id: string;
  title: string;
  startsAt: string; // ISO 8601
  attendees: string[]; // emails
  hasNotes: boolean;
}

export function MeetingList({ meetings }: { meetings: Meeting[] }) {
  // TODO: a <ul> of meetings, earliest first
  return <p>TODO</p>;
}

const demo: Meeting[] = [
  { id: "m2", title: "Design review", startsAt: "2026-10-01T14:00:00Z", attendees: ["raisin@granola.ai", "oat@granola.ai"], hasNotes: false },
  { id: "m1", title: "Standup", startsAt: "2026-10-01T09:30:00Z", attendees: ["oat@granola.ai"], hasNotes: true },
];

preview(() => <MeetingList meetings={demo} />);
