// 20a - React 10: A Reducer for Action Items
//
// Fill in itemsReducer, then ActionItems. Run (Ctrl+Enter) renders the preview() into the Preview tab.

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";

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
  // Pure: never mutate `state`, and return the SAME `state` object when nothing changes.
  switch (action.type) {
    case "add":
      throw new NotImplementedError("add: trim; blank is ignored; append { id, text, done: false }");
    case "toggle":
      throw new NotImplementedError("toggle");
    case "edit":
      throw new NotImplementedError("edit: trim; blank is ignored");
    case "remove":
      throw new NotImplementedError("remove");
    case "clearDone":
      throw new NotImplementedError("clearDone");
  }
}

export function ActionItems({ initial }: { initial?: ActionItem[] }) {
  // TODO: const [items, dispatch] = useReducer(itemsReducer, initial ?? []);
  // TODO: draft text for the "New action item" input, and a useRef counter to make ids
  return (
    <section>
      {/* TODO: a <form> with an input labelled "New action item" and an "Add" button (Enter adds too) */}
      {/* TODO: one <li> per item: a checkbox labelled with its text, and a button with aria-label="Remove <text>" */}
      {/* TODO: "1 of 3 done" and a "Clear done" button, disabled when nothing is done */}
    </section>
  );
}

preview(() => (
  <ActionItems initial={[
    { id: "a1", text: "Send the yoghurt budget to finance", done: false },
    { id: "a2", text: "Book the Q4 offsite", done: true },
  ]} />
));
