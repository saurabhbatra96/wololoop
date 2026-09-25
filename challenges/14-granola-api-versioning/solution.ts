// 14 - Evolving the Notes API: reference solution, all three parts.

const VERSIONS = ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0"] as const;

interface User {
  name: string | null;
  email: string;
}

interface Folder {
  id: string;
  object: "folder";
  name: string;
  parent_folder_id?: string | null;
}

interface TranscriptItem {
  speaker: {
    source: "microphone" | "speaker";
    attribution?: "me" | "them";
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
  private_notes_text?: string | null;
  private_notes_markdown?: string | null;
}

// ------------------------------------------------------------------ part 1

function parseVersion(v: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a), pb = parseVersion(b);
  if (!pa || !pb) throw new TypeError("not a version: " + (pa ? b : a));
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

function resolveVersion(header: string | undefined, keyPinned: string):
    { ok: true; version: string } | { ok: false; error: "unknown_version" } {
  const wanted = header ? header : keyPinned;
  return (VERSIONS as readonly string[]).includes(wanted)
    ? { ok: true, version: wanted }
    : { ok: false, error: "unknown_version" };
}

/** Each entry undoes one release. Rendering for version v applies every entry newer than v, newest first. */
const DOWNGRADES: { version: string; undo: (note: NoteResponse) => NoteResponse }[] = [
  {
    version: "1.5.0",
    undo: ({ private_notes_text, private_notes_markdown, ...rest }) => rest,
  },
  {
    version: "1.3.0",
    undo: (note) => note.transcript === undefined ? note : {
      ...note,
      transcript: note.transcript.map(({ speaker: { attribution, ...speaker }, ...item }) => ({ ...item, speaker })),
    },
  },
  {
    version: "1.1.0",
    undo: (note) => {
      const parents = new Set(note.folder_membership.map((f) => f.parent_folder_id).filter((id) => id));
      return {
        ...note,
        folder_membership: note.folder_membership
          .filter((f) => !parents.has(f.id))
          .map(({ parent_folder_id, ...folder }) => folder),
      };
    },
  },
];

function renderNote(latest: NoteResponse, version: string): NoteResponse {
  return DOWNGRADES
    .filter((d) => compareVersions(d.version, version) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))
    .reduce((note, d) => d.undo(note), latest);
}

// ------------------------------------------------------------------ part 2

type Schema =
  | { type: "string" | "number" | "boolean"; nullable?: boolean }
  | { type: "enum"; values: string[]; open?: boolean; nullable?: boolean }
  | { type: "array"; items: Schema; nullable?: boolean }
  | { type: "object"; properties: Record<string, Property>; nullable?: boolean };
type Property = { schema: Schema; required: boolean };

type ChangeKind =
  | "property_added"
  | "property_removed"
  | "became_required"
  | "became_optional"
  | "became_nullable"
  | "became_non_nullable"
  | "type_changed"
  | "enum_value_added"
  | "enum_value_removed";

type Change = { path: string; kind: ChangeKind; breaking: boolean };

/** What the walker finds, before anyone decides whether it breaks. `detail` carries what the rules need. */
type RawChange = { path: string; kind: ChangeKind; detail: { required?: boolean; open?: boolean } };

function join(path: string, key: string): string {
  return path ? path + "." + key : key;
}

function walk(before: Schema, after: Schema, path: string, out: RawChange[]): void {
  if (before.type !== after.type) {
    out.push({ path, kind: "type_changed", detail: {} });
    return;
  }
  if (!before.nullable && after.nullable) out.push({ path, kind: "became_nullable", detail: {} });
  if (before.nullable && !after.nullable) out.push({ path, kind: "became_non_nullable", detail: {} });

  if (before.type === "enum" && after.type === "enum") {
    if (after.values.some((v) => !before.values.includes(v))) {
      out.push({ path, kind: "enum_value_added", detail: { open: before.open === true } });
    }
    if (before.values.some((v) => !after.values.includes(v))) {
      out.push({ path, kind: "enum_value_removed", detail: {} });
    }
  } else if (before.type === "array" && after.type === "array") {
    walk(before.items, after.items, path + "[]", out);
  } else if (before.type === "object" && after.type === "object") {
    const keys = new Set([...Object.keys(before.properties), ...Object.keys(after.properties)]);
    for (const key of keys) {
      const b = before.properties[key], a = after.properties[key];
      const at = join(path, key);
      if (!b) out.push({ path: at, kind: "property_added", detail: { required: a.required } });
      else if (!a) out.push({ path: at, kind: "property_removed", detail: {} });
      else {
        if (!b.required && a.required) out.push({ path: at, kind: "became_required", detail: {} });
        if (b.required && !a.required) out.push({ path: at, kind: "became_optional", detail: {} });
        walk(b.schema, a.schema, at, out);
      }
    }
  }
}

function diff(before: Schema, after: Schema, breaks: (c: RawChange) => boolean): Change[] {
  const raw: RawChange[] = [];
  walk(before, after, "", raw);
  return raw
    .map((c) => ({ path: c.path, kind: c.kind, breaking: breaks(c) }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
}

/** Responses: the client reads. Anything it might now see that it couldn't before breaks it. */
const RESPONSE_BREAKS: Record<ChangeKind, (c: RawChange) => boolean> = {
  property_added: () => false,
  property_removed: () => true,
  became_required: () => false,
  became_optional: () => true,
  became_nullable: () => true,
  became_non_nullable: () => false,
  type_changed: () => true,
  enum_value_added: (c) => !c.detail.open,
  enum_value_removed: () => false,
};

function diffResponse(before: Schema, after: Schema): Change[] {
  return diff(before, after, (c) => RESPONSE_BREAKS[c.kind](c));
}

// ------------------------------------------------------------------ part 3

/** Requests: the client writes. Anything it used to send that's now rejected breaks it. */
const REQUEST_BREAKS: Record<ChangeKind, (c: RawChange) => boolean> = {
  property_added: (c) => c.detail.required === true,
  property_removed: () => true,
  became_required: () => true,
  became_optional: () => false,
  became_nullable: () => false,
  became_non_nullable: () => true,
  type_changed: () => true,
  enum_value_added: () => false,
  enum_value_removed: () => true,
};

function diffRequest(before: Schema, after: Schema): Change[] {
  return diff(before, after, (c) => REQUEST_BREAKS[c.kind](c));
}

function nextVersion(current: string, changes: Change[]): string {
  const v = parseVersion(current);
  if (!v) throw new TypeError("not a version: " + current);
  const [major, minor, patch] = v;
  if (changes.some((c) => c.breaking)) return major + 1 + ".0.0";
  if (changes.length) return major + "." + (minor + 1) + ".0";
  return major + "." + minor + "." + (patch + 1);
}

main(() => {
  console.log(compareVersions("1.10.0", "1.9.0") > 0);
  console.log(resolveVersion(undefined, "1.2.0"), resolveVersion("1.5.0", "1.2.0"), resolveVersion("1.3", "1.2.0"));
});
