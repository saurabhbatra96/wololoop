// 23 - Mock: Live Transcript (45 minutes)
//
// Run (Ctrl+Enter) renders the preview() at the bottom. Its fake source
// streams a line every 700ms, and redelivers one now and then.

import { useEffect, useState } from "react";

export interface TranscriptLine {
  id: string;
  speaker: "me" | "them";
  name?: string;
  text: string;
  at: string; // ISO 8601, UTC
}

export function Transcript({ lines }: { lines: TranscriptLine[] }) {
  // TODO: sort, group consecutive lines by speaker, render
  return <p>TODO</p>;
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

preview(() => <Transcript lines={demoLines} />);
