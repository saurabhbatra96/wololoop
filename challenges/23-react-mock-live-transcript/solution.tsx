// 23 - Mock: Live Transcript - reference solution, all three parts.

import { Fragment, useEffect, useState, type ReactNode } from "react";

export interface TranscriptLine {
  id: string;
  speaker: "me" | "them";
  name?: string;
  text: string;
  at: string;
}

export interface TranscriptSource {
  subscribe(meetingId: string, onLine: (line: TranscriptLine) => void): () => void;
}

// ------------------------------------------------------------------ part 1

type Group = { key: string; label: string; at: string; lines: TranscriptLine[] };

const labelOf = (line: TranscriptLine) => (line.speaker === "me" ? "You" : line.name ?? "Them");

function groupLines(lines: TranscriptLine[]): Group[] {
  const groups: Group[] = [];
  for (const line of [...lines].sort((a, b) => a.at.localeCompare(b.at))) {
    const last = groups[groups.length - 1];
    const same = last && last.lines[0].speaker === line.speaker && last.lines[0].name === line.name;
    if (same) last.lines.push(line);
    else groups.push({ key: line.id, label: labelOf(line), at: line.at.slice(11, 16), lines: [line] });
  }
  return groups;
}

export function Transcript({ lines, render = (text) => text }: {
  lines: TranscriptLine[];
  render?: (text: string) => ReactNode;
}) {
  if (lines.length === 0) return <p>Waiting for someone to speak…</p>;
  return (
    <div>
      {groupLines(lines).map((g) => (
        <article key={g.key}>
          <h3>{g.label}</h3>
          <time>{g.at}</time>
          {g.lines.map((l) => <p key={l.id}>{render(l.text)}</p>)}
        </article>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ part 3 helpers

function countMatches(text: string, query: string): number {
  if (!query) return 0;
  let count = 0;
  for (let i = text.toLowerCase().indexOf(query); i !== -1; i = text.toLowerCase().indexOf(query, i + query.length)) count++;
  return count;
}

/** Split on matches with indexOf - no RegExp, so "(ok)" and "$5" are just text. */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, from)) {
    if (i > from) parts.push(text.slice(from, i));
    parts.push(<mark key={i}>{text.slice(i, i + query.length)}</mark>);
    from = i + query.length;
  }
  parts.push(text.slice(from));
  return parts.map((p, i) => <Fragment key={i}>{p}</Fragment>);
}

// ------------------------------------------------------------------ part 2 + 3

type SpeakerFilter = "everyone" | "me" | "them";

export function LiveTranscript({ meetingId, source }: { meetingId: string; source: TranscriptSource }) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [held, setHeld] = useState<TranscriptLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [speaker, setSpeaker] = useState<SpeakerFilter>("everyone");

  useEffect(() => {
    let active = true;
    const seen = new Set<string>();
    setLines([]);
    setHeld([]);
    const unsubscribe = source.subscribe(meetingId, (line) => {
      if (!active || seen.has(line.id)) return;
      seen.add(line.id);
      setHeld((prev) => [...prev, line]);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [meetingId, source]);

  // Unpaused, held lines flow straight through. Paused, they wait.
  useEffect(() => {
    if (!paused && held.length) {
      setLines((prev) => [...prev, ...held]);
      setHeld([]);
    }
  }, [paused, held]);

  const q = query.trim().toLowerCase();
  const visible = speaker === "everyone" ? lines : lines.filter((l) => l.speaker === speaker);
  const matches = visible.reduce((n, l) => n + countMatches(l.text, q), 0);
  const filters: [SpeakerFilter, string][] = [["everyone", "Everyone"], ["me", "You"], ["them", "Them"]];

  return (
    <section>
      <div>
        <button type="button" onClick={() => setPaused((p) => !p)}>
          {paused ? `Resume (${held.length} new)` : "Pause"}
        </button>
        <label>Search transcript <input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        {q && <span>{matches} {matches === 1 ? "match" : "matches"}</span>}
        {filters.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={speaker === value} onClick={() => setSpeaker(value)}>{label}</button>
        ))}
      </div>
      <Transcript lines={visible} render={(text) => highlight(text, q)} />
    </section>
  );
}

// ------------------------------------------------------------------ a fake meeting for Run

const SCRIPT: [TranscriptLine["speaker"], string | undefined, string][] = [
  ["me", undefined, "Shall we start with the yoghurt budget?"],
  ["them", "Raisin Patel", "Sure. We spent $100,000 on yoghurt last quarter."],
  ["them", "Raisin Patel", "And made $150,000 in profit, so (ok) not bad."],
  ["me", undefined, "Greek only from now on?"],
  ["them", "Fig", "Greek only."],
  ["them", "Raisin Patel", "Agreed. Regular yoghurt is just milk that gave up halfway."],
];

export const demoLines: TranscriptLine[] = SCRIPT.map(([speaker, name, text], i) => ({
  id: "l" + i, speaker, name, text, at: new Date(Date.UTC(2026, 9, 1, 9, 30, i * 7)).toISOString(),
}));

const demoSource: TranscriptSource = {
  subscribe(_meetingId, onLine) {
    let i = 0;
    const timer = setInterval(() => {
      if (i < demoLines.length) onLine(demoLines[i++]);
      if (i > 1 && i % 3 === 0) onLine(demoLines[i - 1]); // a redelivery
    }, 700);
    return () => clearInterval(timer);
  },
};

preview(() => <LiveTranscript meetingId="demo" source={demoSource} />);
