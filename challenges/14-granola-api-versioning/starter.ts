// 14 - Evolving the Notes API
//
// Note shapes follow docs.granola.ai/api-reference/get-note; the releases are
// the real changelog. Version pinning is the design exercise.

const VERSIONS = ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0"] as const;

interface User {
  name: string | null;
  email: string;
}

interface Folder {
  id: string;
  object: "folder";
  name: string;
  parent_folder_id?: string | null; // since 1.1.0
}

interface TranscriptItem {
  speaker: {
    source: "microphone" | "speaker";
    attribution?: "me" | "them"; // since 1.3.0
    name?: string;
    diarization_label?: string;
  };
  text: string;
  start_time: string;
  end_time: string;
}

interface NoteResponse {
  id: string;
  object: "note";
  title: string | null;
  owner: User;
  created_at: string;
  updated_at: string;
  web_url: string;
  attendees: User[];
  folder_membership: Folder[];
  summary_text: string;
  summary_markdown: string | null;
  transcript?: TranscriptItem[];
  private_notes_text?: string | null; // since 1.5.0
  private_notes_markdown?: string | null; // since 1.5.0
}

function compareVersions(a: string, b: string): number {
  throw new NotImplementedError("compareVersions");
}

function resolveVersion(header: string | undefined, keyPinned: string):
    { ok: true; version: string } | { ok: false; error: "unknown_version" } {
  throw new NotImplementedError("resolveVersion");
}

function renderNote(latest: NoteResponse, version: string): NoteResponse {
  throw new NotImplementedError("renderNote");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  console.log(compareVersions("1.10.0", "1.9.0") > 0);
  console.log(resolveVersion(undefined, "1.2.0"), resolveVersion("1.5.0", "1.2.0"), resolveVersion("1.3", "1.2.0"));
});
