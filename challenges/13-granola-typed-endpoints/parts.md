## Part 1 — Guarding the front door

Swap sides: now you're on the team that **serves** Granola's public API. The
first endpoint is `GET /v1/notes`, and its query parameters are documented in
the [OpenAPI spec](https://docs.granola.ai/api-reference/list-notes). Your job
is the layer that turns a raw query string into something a handler can trust.

```ts
parseListNotesQuery(raw: Record<string, string>): Result<ListNotesQuery, ValidationError>

type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E[] };

interface ListNotesQuery {
  page_size: number;
  created_after?: Date;
  created_before?: Date;
  updated_after?: Date;
  folder_id?: string;
  cursor?: string;
}
```

`ValidationError` is `{ param, code, message }`, with `code` one of
`"unknown_parameter" | "invalid_integer" | "out_of_range" | "invalid_date" | "invalid_format" | "conflict"`,
plus two you'll need later (`"missing"`, `"duplicate_parameter"`). It's all in the starter.

- `page_size`: digits only (`"10"` yes; `"10.0"`, `"1e1"`, `" 5"`, `""` are
  `invalid_integer`), then 1–30 or `out_of_range`. Absent means **10**.
- `created_after`, `created_before`, `updated_after`: either a date,
  `2026-01-27` (midnight UTC), or a date-time with a zone,
  `2026-01-27T15:30:00Z` / `2026-01-27T15:30:00.123+01:00`. Anything else,
  including dates that don't exist like `2026-02-30`, is `invalid_date`.
  (`new Date()` alone will happily accept that and hand you March 2nd.)
- `folder_id`: `fol_` + exactly 14 letters or digits, else `invalid_format`.
- `cursor`: opaque; any non-empty string. Empty is `invalid_format`.
- Any other parameter is `unknown_parameter`. Being strict here is a
  **decision**: a customer who typos `pagesize=30` gets a 400 telling them so,
  instead of silently getting 10 results and filing a bug.
- `created_after` not strictly before `created_before` → one `conflict` error
  on `created_after`. It's a cross-field rule, so it only runs once every
  field is individually valid.
- Report **every** error, not just the first (order doesn't matter). A client
  developer fixing their request one error per round trip hates you.

<!-- part -->

## Part 2 — Schemas that know their types

`/v1/notes/{id}/transcript`, `/v1/folders` and the webhook endpoints all need
the same treatment, and nobody wants to hand-write another 60-line parser.
Build a tiny schema library — think a 40-line Zod — where **the schema is the
single source of truth for both the validation and the type**:

```ts
const listNotesSchema = {
  page_size: int({ min: 1, max: 30, default: 10 }),
  created_after: isoDate(),
  folder_id: pattern(/^fol_[a-zA-Z0-9]{14}$/),
  include: oneOf(["transcript"]),
  owner: pattern(/^.+@.+$/, { required: true }),
};

parseQuery(schema, raw): Result<InferQuery<typeof schema>, ValidationError>
```

Builders: `int({ min, max, default?, required? })`, `isoDate({ required? })`,
`pattern(regex, { required? })`, `oneOf(values, { required? })`. Same error codes
as Part 1, plus `missing` for an absent required field; a value `oneOf`
doesn't list is `invalid_format`.

The type-level contract, which the tests check at compile time:

```ts
type Q = InferQuery<typeof listNotesSchema>;
// {
//   page_size: number;          <- has a default, so never undefined
//   created_after?: Date;       <- optional
//   folder_id?: string;
//   include?: "transcript";     <- literal union, and no `as const` at the call site
//   owner: string;              <- required
// }
```

Then **re-implement `parseListNotesQuery` on top of `parseQuery`**. The Part 1
tests keep running — that's your regression suite for the refactor. The
`conflict` rule is cross-field, so it stays in endpoint code.

> Worth discussing: why keep `InferQuery<typeof schema>` rather than writing
> the interface by hand next to the schema? (Two sources of truth drift; one
> can't.) And what's the cost — how readable is the error when someone gets
> the type wrong?

<!-- part -->

## Part 3 — Routes that know their params

Last piece: a router, so a handler receives **typed** path params and query.

```ts
class Router {
  get<P extends string, S extends QuerySchema>(path: P, query: S, handler: Handler<P, S>): this;
  delete<P extends string, S extends QuerySchema>(path: P, query: S, handler: Handler<P, S>): this;
  handle(method: string, url: string): Promise<{ status: number; body: unknown }>;
}
// Handler<P, S> = (req: { params: PathParams<P>; query: InferQuery<S> }) => ApiResult | Promise<ApiResult>
// ApiResult     = { status: number; body: unknown }
```

```ts
router.get("/v1/notes/:note_id/transcript", { page_size: int({ min: 1, max: 100, default: 50 }) },
  ({ params, query }) => ({ status: 200, body: { id: params.note_id, size: query.page_size } }));
```

`params` is inferred from the path string: `PathParams<"/v1/folders/:folder_id/notes/:note_id">`
is `{ folder_id: string; note_id: string }`, and `params.id` doesn't compile.
Call the type `PathParams` — the tests use it by name.

Runtime rules for `handle`:

- Match whole segments: `:name` matches one non-empty segment, which you
  `decodeURIComponent`. A trailing slash is a different path.
- **Static beats param**, whatever the registration order:
  `/v1/notes/search` must not be swallowed by `/v1/notes/:note_id`. Compare
  segment by segment from the left; the first place they differ decides.
- No path matches → `404 { error: "not_found" }`.
  Path matches, method doesn't → `405 { error: "method_not_allowed", allow: [...] }`, methods sorted.
- A bad query → `400 { error: "invalid_request", details: ValidationError[] }`.
  That includes a parameter given twice (`?page_size=5&page_size=6`), which is
  a `duplicate_parameter` error — `Record<string, string>` can't even
  represent it, so catch it before `parseQuery`.
- A handler that throws → `500 { error: "internal" }`. Never put the
  exception's message in the body — it's how stack traces and SQL end up in
  customers' logs.

`URLSearchParams` is available.

> The follow-up you'll get: this is a typed *server*. How would you get the
> same guarantees on the **client**? (Share the route table's types and derive
> the client from them, tRPC-style — or generate both from the OpenAPI spec,
> which is what a public API with non-TypeScript customers actually needs.)
