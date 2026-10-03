// 21c - React 15: useMemo: reference solution.

import { useMemo, useState } from "react";

type SearchNote = { id: string; title: string; preview: string };

export function NoteSearch({ notes, search }: {
  notes: SearchNote[];
  search: (notes: SearchNote[], query: string) => SearchNote[];
}) {
  const [query, setQuery] = useState("");
  const [showPreviews, setShowPreviews] = useState(false);
  const results = useMemo(() => search(notes, query), [notes, query, search]);

  return (
    <div>
      <label>Search notes <input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <label>
        <input type="checkbox" checked={showPreviews} onChange={(e) => setShowPreviews(e.target.checked)} />
        Show previews
      </label>
      <ul>
        {results.map((n) => (
          <li key={n.id}>
            {n.title}
            {showPreviews && <p>{n.preview}</p>}
          </li>
        ))}
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
