// 12 - Granola Webhook Receiver: reference solution, all three parts.

type WebhookEvent =
  | { event_id: string; event_type: "note.generated"; note_id: string; occurred_at: string }
  | { event_id: string; event_type: "note.edited"; note_id: string; occurred_at: string;
      data: { changed_fields: string[] } }
  | { event_id: string; event_type: "note.access_granted"; note_id: string; occurred_at: string };

type VerifyResult =
  | { ok: true; event: WebhookEvent }
  | { ok: false; reason: "missing_headers" | "bad_signature" | "stale" | "malformed_body" };

interface WebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
}

function base64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function hmacSha256Base64(key: Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
  return btoa(String.fromCharCode(...mac));
}

// ------------------------------------------------------------------ part 1

const EVENT_TYPES = ["note.generated", "note.edited", "note.access_granted"] as const;

/** Compare without an early exit, so timing doesn't leak how much matched. */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function parseEvent(raw: string): WebhookEvent | null {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const type = EVENT_TYPES.find((t) => t === b.event_type);
  if (!type || typeof b.event_id !== "string" || typeof b.note_id !== "string" || typeof b.occurred_at !== "string") {
    return null;
  }
  const base = { event_id: b.event_id, note_id: b.note_id, occurred_at: b.occurred_at };
  if (type !== "note.edited") return { ...base, event_type: type };
  const data = b.data as { changed_fields?: unknown } | undefined;
  const fields = data?.changed_fields;
  if (!Array.isArray(fields) || !fields.every((f) => typeof f === "string")) return null;
  return { ...base, event_type: type, data: { changed_fields: fields } };
}

async function verifyWebhook(
  req: WebhookRequest,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = 300
): Promise<VerifyResult> {
  const id = req.headers["webhook-id"];
  const timestamp = req.headers["webhook-timestamp"];
  const signatures = req.headers["webhook-signature"];
  if (!id || !timestamp || !signatures) return { ok: false, reason: "missing_headers" };

  const key = base64ToBytes(secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret);
  const expected = await hmacSha256Base64(key, id + "." + timestamp + "." + req.rawBody);
  const matched = signatures.split(" ").some((entry) => {
    const comma = entry.indexOf(",");
    return comma > 0 && entry.slice(0, comma) === "v1" && constantTimeEqual(entry.slice(comma + 1), expected);
  });
  if (!matched) return { ok: false, reason: "bad_signature" };

  const sent = Number(timestamp);
  if (!Number.isFinite(sent) || Math.abs(nowSeconds - sent) > toleranceSeconds) return { ok: false, reason: "stale" };

  const event = parseEvent(req.rawBody);
  if (!event || event.event_id !== id) return { ok: false, reason: "malformed_body" };
  return { ok: true, event };
}

// ------------------------------------------------------------------ part 2

type EventType = WebhookEvent["event_type"];
type EventOf<T extends EventType> = Extract<WebhookEvent, { event_type: T }>;
type Handler<T extends EventType> = (event: EventOf<T>) => void | Promise<void>;
type Outcome = "handled" | "duplicate" | "ignored";

class WebhookRouter {
  private readonly handlers = new Map<EventType, Handler<EventType>[]>();
  private readonly done = new Set<string>();
  private readonly inFlight = new Map<string, Promise<void>>();

  on<T extends EventType>(type: T, handler: Handler<T>): this {
    const list = this.handlers.get(type) ?? [];
    // The one cast in the file, and it's sound: handle() only passes this
    // handler events whose event_type is T. TS can't see that through the Map.
    list.push(handler as unknown as Handler<EventType>);
    this.handlers.set(type, list);
    return this;
  }

  async handle(event: WebhookEvent): Promise<Outcome> {
    if (this.done.has(event.event_id)) return "duplicate";
    const running = this.inFlight.get(event.event_id);
    if (running) {
      await running;
      return "duplicate";
    }
    const handlers = this.handlers.get(event.event_type) ?? [];
    if (!handlers.length) return "ignored";

    const run = (async () => {
      for (const handler of handlers) await handler(event);
    })();
    this.inFlight.set(event.event_id, run);
    try {
      await run;
      this.done.add(event.event_id);
      return "handled";
    } finally {
      this.inFlight.delete(event.event_id);
    }
  }
}

// ------------------------------------------------------------------ part 3

interface SyncedNote {
  id: string;
  version: number;
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: unknown) => void;
}

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class NoteSyncer {
  /** A note is in this map while a fetch for it is running; `next` is the queued follow-up. */
  private readonly active = new Map<string, { next: Deferred | null }>();
  private idleWaiters: (() => void)[] = [];

  constructor(
    private readonly fetchNote: (id: string) => Promise<SyncedNote>,
    private readonly save: (note: SyncedNote) => void
  ) {}

  notify(noteId: string): Promise<void> {
    const entry = this.active.get(noteId);
    if (entry) {
      entry.next ??= deferred();
      return entry.next.promise;
    }
    const first = deferred();
    this.active.set(noteId, { next: null });
    void this.run(noteId, first);
    return first.promise;
  }

  idle(): Promise<void> {
    if (this.active.size === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private async run(noteId: string, waiters: Deferred): Promise<void> {
    try {
      this.save(await this.fetchNote(noteId));
      waiters.resolve();
    } catch (err) {
      waiters.reject(err);
    }
    const entry = this.active.get(noteId)!;
    if (entry.next) {
      const next = entry.next;
      entry.next = null;
      void this.run(noteId, next);
      return;
    }
    this.active.delete(noteId);
    if (this.active.size === 0) {
      const waiting = this.idleWaiters;
      this.idleWaiters = [];
      waiting.forEach((resolve) => resolve());
    }
  }
}

main(async () => {
  const secret = "whsec_" + btoa("not-a-real-secret");
  const body = JSON.stringify({ event_id: "evt_1", event_type: "note.generated",
                                note_id: "not_1d3tmYTlCICgjy", occurred_at: "2026-01-27T15:30:00Z" });
  const signature = await hmacSha256Base64(base64ToBytes(secret.slice(6)), "evt_1.1769527800." + body);
  const headers = { "webhook-id": "evt_1", "webhook-timestamp": "1769527800", "webhook-signature": "v1," + signature };
  console.log(await verifyWebhook({ headers, rawBody: body }, secret, 1769527810));
});
