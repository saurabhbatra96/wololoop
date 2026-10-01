// 20 - Reducers and Custom Hooks
//
// Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { useReducer, useState } from "react";

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export type Action =
  | { type: "add"; id: string; text: string }
  | { type: "toggle"; id: string }
  | { type: "edit"; id: string; text: string }
  | { type: "remove"; id: string }
  | { type: "clearDone" };

export function itemsReducer(state: ActionItem[], action: Action): ActionItem[] {
  throw new NotImplementedError("itemsReducer");
}

export function ActionItems({ initial }: { initial?: ActionItem[] }) {
  // TODO: useReducer(itemsReducer, initial ?? [])
  return <p>TODO</p>;
}

preview(() => (
  <ActionItems initial={[
    { id: "a1", text: "Send the yoghurt budget to finance", done: false },
    { id: "a2", text: "Book the Q4 offsite", done: true },
  ]} />
));
