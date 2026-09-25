// Tests for 14 - Evolving the Notes API.

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function latestNote() {
  return deepFreeze({
    id: "not_1d3tmYTlCICgjy",
    object: "note" as const,
    title: "Quarterly yoghurt budget review",
    owner: { name: "Oat Benson", email: "oat@granola.ai" },
    created_at: "2026-01-27T15:30:00Z",
    updated_at: "2026-01-27T16:45:00Z",
    web_url: "https://notes.granola.ai/d/f3e45e0f",
    attendees: [{ name: "Raisin Patel", email: "raisin@granola.ai" }],
    folder_membership: [
      { id: "fol_4y6LduVdwSKC27", object: "folder" as const, name: "Top secret recipes", parent_folder_id: "fol_a74g2hvl98iUHG" },
      { id: "fol_a74g2hvl98iUHG", object: "folder" as const, name: "Food", parent_folder_id: "fol_root0000000000" },
      { id: "fol_root0000000000", object: "folder" as const, name: "Company", parent_folder_id: null },
      { id: "fol_budget00000000", object: "folder" as const, name: "Budgets", parent_folder_id: null },
    ],
    summary_text: "It went well.",
    summary_markdown: "## It went well",
    transcript: [
      { speaker: { source: "microphone" as const, attribution: "me" as const }, text: "Greek only.",
        start_time: "2026-01-27T15:30:00Z", end_time: "2026-01-27T15:30:02Z" },
      { speaker: { source: "speaker" as const, attribution: "them" as const, name: "Raisin Patel" }, text: "Finally.",
        start_time: "2026-01-27T15:30:03Z", end_time: "2026-01-27T15:30:04Z" },
    ],
    private_notes_text: "Push back on the dairy forecast.",
    private_notes_markdown: "Push back on the **dairy** forecast.",
  });
}

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

// ------------------------------------------------------------------ part 1

test(1, "compareVersions is numeric, not lexical", () => {
  assert(compareVersions("1.10.0", "1.9.0") > 0, "1.10.0 > 1.9.0");
  assert(compareVersions("1.2.0", "1.10.0") < 0, "1.2.0 < 1.10.0");
  assert(compareVersions("2.0.0", "1.99.99") > 0, "major wins");
  assert(compareVersions("1.0.10", "1.0.9") > 0, "patch counts");
  assertEqual(compareVersions("1.3.0", "1.3.0"), 0);
});

test(1, "resolveVersion: the header wins, the key's pin is the fallback", () => {
  assertEqual(resolveVersion("1.5.0", "1.2.0"), { ok: true, version: "1.5.0" });
  assertEqual(resolveVersion("1.0.0", "1.2.0"), { ok: true, version: "1.0.0" });
  assertEqual(resolveVersion(undefined, "1.2.0"), { ok: true, version: "1.2.0" });
  assertEqual(resolveVersion("", "1.2.0"), { ok: true, version: "1.2.0" });
});

test(1, "resolveVersion refuses anything that isn't a release", () => {
  for (const bad of ["1.3", "2.0.0", "latest", "v1.3.0", "1.3.0 ", "1.6.0"]) {
    assertEqual(resolveVersion(bad, "1.2.0"), { ok: false, error: "unknown_version" }, JSON.stringify(bad));
  }
});

test(1, "latest renders unchanged", () => {
  assertEqual(renderNote(latestNote(), "1.5.0"), latestNote());
});

test(1, "before 1.5.0 there are no private notes keys at all", () => {
  const note = renderNote(latestNote(), "1.4.0");
  assert(!has(note, "private_notes_text") && !has(note, "private_notes_markdown"),
         "the keys must be gone, not set to undefined or null");
  assertEqual(note.transcript?.[0].speaker.attribution, "me", "1.4.0 still has attribution");
});

test(1, "before 1.3.0 speakers have no attribution", () => {
  const note = renderNote(latestNote(), "1.2.0");
  assertEqual(note.transcript?.map((t) => t.speaker), [{ source: "microphone" }, { source: "speaker", name: "Raisin Patel" }]);
  assert(note.transcript!.every((t) => !has(t.speaker, "attribution")), "attribution key must be gone");
  assertEqual(note.folder_membership.length, 4, "1.2.0 still has ancestors");
});

test(1, "before 1.1.0 folder_membership is direct folders only, without parent ids", () => {
  const note = renderNote(latestNote(), "1.0.0");
  assertEqual(note.folder_membership, [
    { id: "fol_4y6LduVdwSKC27", object: "folder", name: "Top secret recipes" },
    { id: "fol_budget00000000", object: "folder", name: "Budgets" },
  ]);
  assert(note.folder_membership.every((f) => !has(f, "parent_folder_id")), "parent_folder_id key must be gone");
  assert(!has(note, "private_notes_text") && !has(note.transcript![0].speaker, "attribution"), "older downgrades apply too");
});

test(1, "a note without a transcript downgrades cleanly", () => {
  const { transcript, ...rest } = latestNote();
  const note = renderNote(deepFreeze(rest), "1.0.0");
  assert(!has(note, "transcript"), "don't invent a transcript");
  assertEqual(note.title, "Quarterly yoghurt budget review");
});

test(1, "the latest note is never mutated", () => {
  const latest = latestNote();
  for (const v of ["1.0.0", "1.2.0", "1.4.0", "1.5.0"]) renderNote(latest, v); // frozen: mutation would throw
  assertEqual(latest, latestNote());
});

// ------------------------------------------------------------------ part 2

// Tiny schema constructors so the fixtures stay readable. Typed structurally,
// so they compile before your Schema type exists.
type TestSchema = { type: string; [k: string]: unknown };
const str = (nullable = false) => ({ type: "string" as const, nullable });
const num = () => ({ type: "number" as const });
const en = (values: string[], open = false) => ({ type: "enum" as const, values, open });
const arr = (items: TestSchema) => ({ type: "array" as const, items });
const obj = (properties: Record<string, [TestSchema, boolean]>, nullable = false) => ({
  type: "object" as const,
  nullable,
  properties: Object.fromEntries(Object.entries(properties).map(([k, [schema, required]]) => [k, { schema, required }])),
});

/** @stage 2 */
function changes(fn: (a: Schema, b: Schema) => Change[], before: TestSchema, after: TestSchema): string[] {
  return fn(before as Schema, after as Schema).map((c) => (c.breaking ? "BREAKING " : "") + c.kind + " @ " + c.path);
}

function speakerSchema(opts: { attribution?: boolean; sources?: string[]; open?: boolean }) {
  const props: Record<string, [TestSchema, boolean]> = { source: [en(opts.sources ?? ["microphone", "speaker"], opts.open), true] };
  if (opts.attribution) props.attribution = [en(["me", "them"]), false];
  return obj({ speaker: [obj(props), true], text: [str(), true] });
}

function noteSchema(opts: { attribution?: boolean; privateNotes?: boolean; titleNullable?: boolean; sources?: string[]; open?: boolean }) {
  const props: Record<string, [TestSchema, boolean]> = {
    id: [str(), true],
    title: [str(opts.titleNullable ?? true), true],
    transcript: [arr(speakerSchema(opts)), false],
  };
  if (opts.privateNotes) {
    props.private_notes_text = [str(true), false];
    props.private_notes_markdown = [str(true), false];
  }
  return obj(props);
}

test(2, "identical schemas have no changes", () => {
  assertEqual(changes(diffResponse, noteSchema({}), noteSchema({})), []);
});

test(2, "the real 1.3.0: an optional nested field is a non-breaking addition", () => {
  assertEqual(changes(diffResponse, noteSchema({}), noteSchema({ attribution: true })),
              ["property_added @ transcript[].speaker.attribution"]);
});

test(2, "the real 1.5.0: two new optional fields, sorted by path", () => {
  assertEqual(changes(diffResponse, noteSchema({ attribution: true }), noteSchema({ attribution: true, privateNotes: true })),
              ["property_added @ private_notes_markdown", "property_added @ private_notes_text"]);
});

test(2, "removing a field breaks readers", () => {
  assertEqual(changes(diffResponse, noteSchema({ privateNotes: true }), noteSchema({})),
              ["BREAKING property_removed @ private_notes_markdown", "BREAKING property_removed @ private_notes_text"]);
});

test(2, "required/optional and nullability, response direction", () => {
  const a = obj({ x: [str(), false], y: [str(), true], z: [str(false), true], w: [str(true), true] });
  const b = obj({ x: [str(), true], y: [str(), false], z: [str(true), true], w: [str(false), true] });
  assertEqual(changes(diffResponse, a, b), [
    "became_non_nullable @ w", "became_required @ x", "BREAKING became_optional @ y", "BREAKING became_nullable @ z",
  ]);
});

test(2, "a type change is reported once, without looking inside", () => {
  const a = obj({ n: [str(), true], s: [en(["a"]), true], o: [obj({ deep: [str(), true] }), true] });
  const b = obj({ n: [num(), true], s: [str(), true], o: [arr(str()), true] });
  assertEqual(changes(diffResponse, a, b), ["BREAKING type_changed @ n", "BREAKING type_changed @ o", "BREAKING type_changed @ s"]);
});

test(2, "enum additions break closed enums only; removals don't break readers", () => {
  const closed = changes(diffResponse, noteSchema({}), noteSchema({ sources: ["microphone", "speaker", "system"] }));
  assertEqual(closed, ["BREAKING enum_value_added @ transcript[].speaker.source"]);
  const open = changes(diffResponse, noteSchema({ open: true }), noteSchema({ sources: ["microphone", "speaker", "system", "phone"] }));
  assertEqual(open, ["enum_value_added @ transcript[].speaker.source"], "open enum, and one change for two new values");
  assertEqual(changes(diffResponse, noteSchema({}), noteSchema({ sources: ["microphone"] })),
              ["enum_value_removed @ transcript[].speaker.source"]);
});

test(2, "root-level and array-level changes use \"\" and []", () => {
  assertEqual(changes(diffResponse, obj({}), obj({}, true)), ["BREAKING became_nullable @ "]);
  assertEqual(changes(diffResponse, arr(str()), arr(str(true))), ["BREAKING became_nullable @ []"]);
});

test(2, "changes are sorted by path, then kind", () => {
  const a = obj({ b: [en(["x", "y"]), false], a: [str(), true] });
  const b = obj({ b: [en(["x", "z"]), true], a: [str(), true], c: [str(), false] });
  assertEqual(changes(diffResponse, a, b),
              ["became_required @ b", "BREAKING enum_value_added @ b", "enum_value_removed @ b", "property_added @ c"]);
});

test(2, "Change.kind is a closed union, not string", () => {
  const ok: Change["kind"] = "enum_value_removed";
  // @ts-expect-error - not a ChangeKind
  const nope: Change["kind"] = "field_renamed";
  const flag: boolean = (null as unknown as Change | null)?.breaking ?? false;
  void [ok, nope, flag];
});

// ------------------------------------------------------------------ part 3

test(3, "requests: adding a param breaks only if it's required", () => {
  const before = obj({ page_size: [num(), false] });
  const after = obj({ page_size: [num(), false], folder_id: [str(), false], workspace: [str(), true] });
  assertEqual(changes(diffRequest, before, after),
              ["property_added @ folder_id", "BREAKING property_added @ workspace"]);
});

test(3, "requests: removing a param breaks, because unknown params are rejected", () => {
  assertEqual(changes(diffRequest, obj({ cursor: [str(), false] }), obj({})), ["BREAKING property_removed @ cursor"]);
});

test(3, "requests: requiredness and nullability flip", () => {
  const a = obj({ x: [str(), false], y: [str(), true], z: [str(false), true], w: [str(true), true] });
  const b = obj({ x: [str(), true], y: [str(), false], z: [str(true), true], w: [str(false), true] });
  assertEqual(changes(diffRequest, a, b), [
    "BREAKING became_non_nullable @ w", "BREAKING became_required @ x", "became_optional @ y", "became_nullable @ z",
  ]);
});

test(3, "requests: enums flip too, and open doesn't matter", () => {
  const include = (values: string[], open = false) => obj({ include: [en(values, open), false] });
  assertEqual(changes(diffRequest, include(["transcript"]), include(["transcript", "attendees"])),
              ["enum_value_added @ include"]);
  assertEqual(changes(diffRequest, include(["transcript", "attendees"], true), include(["transcript"], true)),
              ["BREAKING enum_value_removed @ include"]);
});

test(3, "the same diff, opposite verdicts", () => {
  const a = obj({ title: [str(false), true] });
  const b = obj({ title: [str(true), false] });
  assertEqual(changes(diffResponse, a, b), ["BREAKING became_nullable @ title", "BREAKING became_optional @ title"]);
  assertEqual(changes(diffRequest, a, b), ["became_nullable @ title", "became_optional @ title"]);
});

test(3, "nextVersion: breaking is major, any change is minor, none is patch", () => {
  const breaking = diffResponse(noteSchema({ privateNotes: true }) as Schema, noteSchema({}) as Schema);
  const additive = diffResponse(noteSchema({}) as Schema, noteSchema({ attribution: true }) as Schema);
  assertEqual(nextVersion("1.5.0", breaking), "2.0.0");
  assertEqual(nextVersion("1.2.0", additive), "1.3.0");
  assertEqual(nextVersion("1.5.0", []), "1.5.1");
  assertEqual(nextVersion("1.9.3", additive), "1.10.0");
});

