## Part 1 — Old clients, new server

Granola's API has shipped six releases in eight months. From the real
[changelog](https://docs.granola.ai/api-reference/changelog):

| Version | What changed in the note response |
|---|---|
| 1.0.0 | first release; `folder_membership` lists the folders a note is **directly** in |
| 1.1.0 | folders get `parent_folder_id`; `folder_membership` now also lists every **ancestor** folder |
| 1.2.0 | new API key scopes (no response change) |
| 1.3.0 | transcript items get `speaker.attribution` (`"me"` / `"them"`) |
| 1.4.0 | new transcript endpoint (no change to the note shape) |
| 1.5.0 | `private_notes_text` and `private_notes_markdown` added |

The design exercise (Granola doesn't do this today): an integration written
against 1.0 must keep working **forever**, even as the server moves on. So
each API key is pinned to the version current when it was created, a request
can override that with a `Granola-Version` header, and the server always builds
the **latest** response and then **downgrades** it, one release at a time,
newest first.

```ts
compareVersions(a: string, b: string): number             // <0, 0, >0 — "1.10.0" > "1.9.0"
resolveVersion(header: string | undefined, keyPinned: string):
  { ok: true; version: string } | { ok: false; error: "unknown_version" }
renderNote(latest: NoteResponse, version: string): NoteResponse
```

- `resolveVersion`: a non-empty header wins; otherwise the key's pin. Anything
  not exactly a released version (`"1.3"`, `"2.0.0"`, `"latest"`) is
  `unknown_version` — failing loudly beats guessing.
- `renderNote` undoes each release **newer than** the requested one:
  - before **1.5.0**: no `private_notes_text` or `private_notes_markdown` keys at all.
  - before **1.3.0**: no `attribution` on any transcript speaker.
  - before **1.1.0**: `folder_membership` goes back to **direct** containers only —
    a folder is direct if no other folder in the list has it as its parent —
    and no folder has a `parent_folder_id` key.
- **Never mutate `latest`.** The server renders one note for many clients on
  different versions; the tests hand you deep-frozen objects.

> The question behind the question: why downgrade from latest rather than
> keep a separate renderer per version? (Six renderers means every bug fix six
> times; one renderer plus small, dated transforms is how Stripe has kept
> 2011-era integrations alive.) And what can't be downgraded? Look at 1.4.0 —
> a **behaviour** change (a 413 for huge transcripts) isn't a field you can
> delete.

<!-- part -->

## Part 2 — What counts as breaking?

Pinning only helps if someone **notices** a change needs a new version. Build
the check that runs in CI on every pull request: diff the old and new response
schema and flag anything that breaks existing clients.

```ts
type Schema =
  | { type: "string" | "number" | "boolean"; nullable?: boolean }
  | { type: "enum"; values: string[]; open?: boolean; nullable?: boolean }
  | { type: "array"; items: Schema; nullable?: boolean }
  | { type: "object"; properties: Record<string, Property>; nullable?: boolean };
type Property = { schema: Schema; required: boolean };

type Change = { path: string; kind: ChangeKind; breaking: boolean };

diffResponse(before: Schema, after: Schema): Change[]
```

`ChangeKind` is exactly `"property_added" | "property_removed" |
"became_required" | "became_optional" | "became_nullable" |
"became_non_nullable" | "type_changed" | "enum_value_added" |
"enum_value_removed"`.

Paths look like `transcript[].speaker.attribution`: dot between properties,
`[]` for array items, `""` for the root. At most one change of each kind per
path — three new enum values is one `enum_value_added`. An added or removed
property is one change; don't descend into it. Return changes sorted by path,
then kind. For a **response** — data the client **reads** — ask "could code that
worked yesterday break today?":

| Change | Breaking? | Why |
|---|---|---|
| property added | no | clients ignore fields they don't know |
| property removed | **yes** | `note.title.trim()` now throws |
| optional → required | no | it was sometimes there; now always |
| required → optional | **yes** | clients never checked for absence |
| becomes nullable | **yes** | same, for `null` |
| becomes non-nullable | no | |
| type changed (`string` → `number`, `enum` → `string`, …) | **yes** | don't look inside it any further |
| enum value removed | no | clients just never see it |
| enum value added | **yes**, unless the old enum was `open` | exhaustive `switch`es hit `default` or crash |

That last row is real: Granola's docs for `speaker.source` say *clients should
not assume this will never expand*. That sentence is them marking the enum
`open`, so adding a value later isn't a breaking change.

> Be ready to argue the grey areas. Is adding a field **ever** breaking?
> (Yes — for a client that does strict deserialization, or if the payload
> crosses a size limit.) Who decides, the diff tool or a human?

<!-- part -->

## Part 3 — Requests flip the rules

Request schemas (query params, JSON bodies) are data the client **writes**
and the server reads. The same change can be harmless in a response and
breaking in a request, or vice versa. That's variance: responses are
covariant, requests contravariant.

```ts
diffRequest(before: Schema, after: Schema): Change[]
nextVersion(current: string, changes: Change[]): string
```

`diffRequest` finds the **same** changes as `diffResponse` — reuse your walker —
but decides `breaking` by asking "will a request that worked yesterday be
rejected today?":

| Change | Breaking? |
|---|---|
| property added | only if it's **required** — old clients don't send it |
| property removed | **yes** — our API rejects unknown parameters (challenge 13), so old clients sending it now get a 400 |
| optional → required | **yes** |
| required → optional | no |
| becomes nullable | no |
| becomes non-nullable | **yes** |
| type changed | **yes** |
| enum value added | no — `open` doesn't matter here |
| enum value removed | **yes** — someone was sending it |

`nextVersion` is semver on top of the diff: any breaking change → next
**major** (`1.5.0` → `2.0.0`); otherwise any change at all → next **minor**
(`1.5.0` → `1.6.0`); no changes → next **patch** (`1.5.0` → `1.5.1`).

> Check yourself against the changelog: 1.3.0 added an optional response
> field — minor, correct. What would Granola have had to call it if
> `attribution` had been added as a **required** field of a request body?
