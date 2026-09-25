## Part 1 — Is this really from Granola?

Granola can POST to your server when a note changes, so an integration doesn't
have to poll. You're writing the receiving end. Everything here follows the
real [webhooks docs](https://docs.granola.ai/webhooks), which follow the
[Standard Webhooks](https://www.standardwebhooks.com/) spec.

A delivery carries three headers and a small JSON body:

| Header | Contents |
|---|---|
| `webhook-id` | the event id — equal to `event_id` in the body |
| `webhook-timestamp` | Unix seconds of **this delivery attempt** |
| `webhook-signature` | space-separated `v1,<base64 signature>` entries |

The signature is HMAC-SHA256 over the string `` `${id}.${timestamp}.${rawBody}` ``,
keyed with your signing secret. The secret looks like `whsec_<base64>`: strip
the prefix and base64-decode the rest to get the key bytes. The starter gives
you `hmacSha256Base64(key, message)` and `base64ToBytes` so you don't spend
the interview on WebCrypto.

```ts
verifyWebhook(
  req: { headers: Record<string, string>; rawBody: string },
  secret: string,
  nowSeconds: number,
  toleranceSeconds?: number,          // default 300
): Promise<VerifyResult>

type VerifyResult =
  | { ok: true; event: WebhookEvent }
  | { ok: false; reason: "missing_headers" | "bad_signature" | "stale" | "malformed_body" };
```

- Any of the three headers missing → `missing_headers`.
- **Several signatures** may be present (that's how secret rotation works).
  Accept if **any** `v1` entry matches; ignore other versions.
- A timestamp more than `toleranceSeconds` away from `nowSeconds`, in either
  direction, is `stale` — that's what stops a captured request being replayed
  next week. Check it **after** the signature, so an attacker can't learn
  anything from which error they get.
- Parse JSON only **after** the signature checks out. Bad JSON, a body that
  doesn't look like a `WebhookEvent`, or `event_id` not matching `webhook-id`
  → `malformed_body`.
- Return, don't throw. The caller is going to turn this into an HTTP status.

> Things you'll be asked: why sign the raw body rather than the parsed JSON?
> (Re-serialising can change key order or whitespace, and then nothing
> matches.) Why compare signatures in constant time? And which status do you
> send for each failure — given that Granola **retries** 408/429/5xx and
> **gives up** on any other 4xx?

<!-- part -->

## Part 2 — Typed handlers, exactly once

Receiving is the easy half. Now route events to handlers:

```ts
class WebhookRouter {
  on(type, handler): this;                         // chainable
  handle(event: WebhookEvent): Promise<"handled" | "duplicate" | "ignored">;
}
```

The type contract is the point of this part:

```ts
router
  .on("note.edited", (e) => console.log(e.data.changed_fields))  // e is the edited variant
  .on("note.generated", (e) => e.note_id);                        // no .data here
```

- `on` is generic over the event type, and the handler's parameter is
  **narrowed** to that one variant of the union — no casts, no `any`, no
  checking `e.event_type` inside the handler. `on("note.deleted", …)` must not
  compile. (Hint: `Extract`.)
- Several handlers for one type run **in registration order**, one after
  another. No handler for this type → `"ignored"`.

And deliveries are **at least once**. Granola retries until you return 2xx,
reusing `event_id` every time, so:

- An event already handled successfully → `"duplicate"`, handlers not called.
- If a handler **throws**, `handle` rejects with that error and the event is
  **not** remembered — the retry must run it again.
- Two deliveries of the same event can arrive **at the same time** (a retry
  racing a slow first attempt). The second must not run handlers; it waits for
  the first and returns `"duplicate"` if that succeeded, or rejects with the
  same error if it failed.

> This is in-memory, so it's per-process. Be ready to say what changes with
> three instances behind a load balancer (a shared store with an atomic
> "insert if absent", and a lease so a crashed worker's claim expires), and why
> "remember forever" needs a TTL — Granola only retries for four days.

<!-- part -->

## Part 3 — Fetch once, however loud

Webhook payloads carry **no note content**, just `note_id`. You're meant to
fetch the note from the API when you're told it changed. Your handler will
call a syncer:

```ts
interface SyncedNote { id: string; version: number }   // all the tests need of a note

class NoteSyncer {
  constructor(fetchNote: (id: string) => Promise<SyncedNote>, save: (note: SyncedNote) => void);
  notify(noteId: string): Promise<void>;
  idle(): Promise<void>;
}
```

Someone editing a summary produces a burst: five `note.edited` events for one
note inside a second. Five fetches is wasteful, but one fetch *might have read
the note before the last edit landed*. The rule that's both cheap and correct:

- At most **one fetch per note in flight**.
- `notify` while nothing is in flight for that note → fetch now.
- `notify` while a fetch **is** in flight → exactly **one follow-up fetch**
  runs after it finishes, however many notifies arrived meanwhile. They all
  share that follow-up.
- Different notes fetch **in parallel**.
- `notify`'s promise resolves once a fetch that **started after** that call has
  been saved — i.e., once the stored note is at least as new as the
  notification. A notify that joined an in-flight fetch waits for the
  follow-up, not the one already running.
- A failed fetch rejects the promises that were waiting on it and saves
  nothing. It doesn't wedge the note: the next `notify` fetches again.
- `idle()` resolves when nothing is in flight or queued (failures included).

> This "one in flight, one queued" shape is a latest-wins coalescer, the same
> as a debounced autosave or `requestAnimationFrame`. Worth naming it, and
> saying why a plain debounce timer is worse here (it adds latency to *every*
> event to save work only during bursts).
