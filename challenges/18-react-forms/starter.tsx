// 18 - Forms and Controlled Inputs
//
// Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { useState } from "react";

export interface NoteDraft {
  title: string;
  body: string;
}

export function NoteForm({ onSubmit }: { onSubmit: (draft: NoteDraft) => void }) {
  // TODO: controlled Title input, Body textarea, Save button
  return <form>TODO</form>;
}

preview(() => <NoteForm onSubmit={(draft) => console.log("submitted", draft)} />);
