// 21c - React 15: useMemo
//
// Fill in NoteSearch. Run (Ctrl+Enter) renders the preview() into the Preview tab.

import { useMemo, useState } from "react";

type SearchNote = { id: string; title: string; preview: string };

export function NoteSearch({ notes, search }: {
  notes: SearchNote[];
  search: (notes: SearchNote[], query: string) => SearchNote[]; // pretend this is slow
}) {
  const [query, setQuery] = useState("");
  const [showPreviews, setShowPreviews] = useState(false);

  // TODO: run search(notes, query) - but only again when something it depends on changes
  const results: SearchNote[] = [];

  return (
    <div>
      <label>Search notes <input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      {/* TODO: a checkbox labelled "Show previews" */}
      <ul>
        {/* TODO: one <li key> per result: the title, plus a <p> preview when Show previews is ticked */}
      </ul>
    </div>
  );
}

const demo: SearchNote[] = [
  { id: "n1", title: "Standup", preview: "Blocked on review" },
  { id: "n2", title: "Retro", preview: "More snacks" },
];

preview(() => (
  <NoteSearch notes={demo} search={(notes, q) => {
    console.log("search ran for", JSON.stringify(q));
    return notes.filter((n) => n.title.toLowerCase().includes(q.toLowerCase()));
  }} />
));
