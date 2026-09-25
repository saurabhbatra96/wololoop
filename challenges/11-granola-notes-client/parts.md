## Part 1 — Every note, a page at a time

Granola has a public REST API for meeting notes. You're writing the TypeScript
client that customers `npm install` so they don't have to hand-roll it. The
shapes below are taken from the real [API reference](https://docs.granola.ai/api-reference/list-notes).

`GET /v1/notes` returns one page:

```ts
{ notes: NoteSummary[]; hasMore: boolean; cursor: string | null }
```

Pass `cursor` back to get the next page. Filters are query parameters in
snake_case: `created_after`, `created_before`, `updated_after`, `folder_id`,
plus `page_size` (1–30, the server's default is 10).

You don't get `fetch`. The client talks through an injected `Transport`, which
is already typed in the starter:

```ts
type Transport = (req: ApiRequest) => Promise<ApiResponse>;
```

Build this:

```ts
class GranolaClient {
  constructor(options: { transport: Transport; pageSize?: number });
  listNotes(filter?: NoteFilter): AsyncIterable<NoteSummary>;
}
```

- `listNotes` yields **every** note across every page, in order. Callers write
  `for await (const note of client.listNotes())` and never see a cursor.
- It's **lazy**: page 2 is not requested until the caller has consumed page 1.
  If they `break` after three notes, exactly one request went out.
- Map `createdAfter` → `created_after` and so on. Filters that are `undefined`
  are **left out** of the query — never sent as the string `"undefined"`.
- `page_size` is always sent. `pageSize` defaults to 10; outside 1–30 (or not
  an integer), the constructor throws a `RangeError` — a typo should fail at
  startup, not on the first request.
- Any non-2xx response throws a `GranolaApiError` (in the starter) with its
  `status`.
- If the server says `hasMore: true` but hands you a `null` cursor, throw
  `GranolaApiError` rather than loop forever re-reading page 1.

```ts
const client = new GranolaClient({ transport, pageSize: 2 });
for await (const note of client.listNotes({ folderId: "fol_4y6LduVdwSKC27" })) {
  console.log(note.title);
}
```

> The interviewer is watching the public surface more than the loop. Why an
> `AsyncIterable` and not `Promise<NoteSummary[]>`? What happens to memory for
> a customer with 40,000 notes? What does the caller have to know about
> cursors? (Nothing — that's the point.)

<!-- part -->

## Part 2 — Retries that don't make it worse

The API is rate limited (5 requests/second sustained), and a nightly sync job
iterating 40,000 notes *will* hit it. Right now one 429 on page 800 throws away
the whole run.

Add retries. The constructor grows:

```ts
new GranolaClient({
  transport,
  sleep,                                    // (ms: number) => Promise<void>
  retry: { maxAttempts: 4, baseDelayMs: 250 },  // these are the defaults
});
```

`sleep` is injected for the same reason the transport is: tests must not
wait. Default it to a real `setTimeout` sleep.

Rules:

- **Retry** on `408`, `429`, any `5xx`, and when the transport itself throws
  (a network error). **Don't retry** any other 4xx — a `401` will be a `401`
  forever, and retrying it just burns the customer's rate limit.
- `maxAttempts` counts **total** attempts, including the first.
- Delay before retry *n* (1-based) is `baseDelayMs * 2^(n-1)`: 250, 500, 1000.
  If the response carries a `retry-after` header (seconds), use that instead —
  the server knows better than your formula.
- Out of attempts → throw the **last** error.
- A retried page request uses the **same cursor**. A blip on page 3 must not
  skip or duplicate notes.

`GranolaApiError` needs to become something a caller can branch on. Give it:

```ts
readonly status: number | null;   // null for network errors
readonly code: ApiErrorCode;      // a string-literal union, not `string`
readonly retryable: boolean;
readonly attempts: number;        // how many tries it took to give up
```

with `ApiErrorCode` exactly
`"bad_request" | "unauthorized" | "not_found" | "rate_limited" | "server_error" | "network" | "transcript_too_large" | "unknown"`
(`408` is `"unknown"` but retryable; `413` is `"transcript_too_large"`).
The tests check the union with `@ts-expect-error`, so a plain `string` fails
them even if every runtime value is right.

> Be ready for: "Why no jitter?" (You'd add it in production — a thousand
> clients retrying on the same exponential schedule is a synchronized
> stampede. It's left out here because it makes tests nondeterministic; the
> fix is to inject `random` just like `sleep`.) And: "Should a `POST` retry?"
> Only if it's idempotent or carries an idempotency key.

<!-- part -->

## Part 3 — Transcripts and fan-out

Two new customer asks.

**1. Notes with transcripts.** `GET /v1/notes/{id}?include=transcript` returns
the note with a `transcript` array. But since August, a long meeting gets
`413 { code: "TRANSCRIPT_TOO_LARGE" }` instead, and the transcript must be read
from `GET /v1/notes/{id}/transcript`, which is cursor-paged like the notes list
(`{ transcript, hasMore, cursor }`, `page_size` up to 100).

```ts
getNote(id: string): Promise<Note>;
getNote(id: string, options: { include: "transcript" }): Promise<NoteWithTranscript>;
```

- These are **overloads**: the return type depends on the argument. Plain
  `getNote(id)` must *not* have a `transcript` property at the type level.
- On `TRANSCRIPT_TOO_LARGE`, fall back transparently: fetch the note without
  `include`, then page through `/transcript` with `page_size: "100"`, and
  return the same shape as the happy path. Callers never learn it happened.
- A note id is `not_` followed by exactly 14 letters or digits. Anything else
  throws a `TypeError` **before** any request is made — a malformed id should
  never cost a rate-limit token.

**2. Bulk fetch.** A customer has 300 note ids and wants all of them, but
fire-hosing 300 requests at a 5/s API is how you get 300 429s.

```ts
getNotes(ids: string[], options?: { concurrency?: number }): Promise<NoteResult[]>;
type NoteResult =
  | { id: string; ok: true; note: Note }
  | { id: string; ok: false; error: GranolaApiError };
```

- At most `concurrency` (default 4) requests in flight at once.
- Results come back in **input order**, whatever order they finish in.
- One failed note doesn't fail the batch; it becomes an `ok: false` entry. The
  other 299 are still worth having. (Retries from Part 2 still apply per note.)

> The senior half of this: why a discriminated union and not `Promise.allSettled`?
> (The caller gets the `id` with the failure, and `if (r.ok)` narrows to
> `r.note` with no casts.) Where should concurrency live — in the client, or
> should the rate limit be shared across every call the client makes? What
> would you change if the API returned a `ratelimit-remaining` header?
