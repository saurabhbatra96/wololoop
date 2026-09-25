// Tests for 12 - Granola Webhook Receiver.

const SECRET_BYTES = "c2VjcmV0LWtleS1mb3Itd29sb2xvb3AtdGVzdHM="; // base64 of a test key
const SECRET = "whsec_" + SECRET_BYTES;
const NOW = 1769527800;

async function testSign(secretB64: string, id: string, ts: string, body: string): Promise<string> {
  const key = Uint8Array.from(atob(secretB64), (c) => c.charCodeAt(0));
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(id + "." + ts + "." + body)));
  return btoa(String.fromCharCode(...mac));
}

function testEvent(overrides: Record<string, unknown> = {}) {
  return { event_id: "8f1c2a4e-6b3d-4e8f-9a2b-1c5d7e9f0a3b", event_type: "note.generated",
           note_id: "not_1d3tmYTlCICgjy", occurred_at: "2026-01-27T15:30:00Z", ...overrides };
}

async function signedDelivery(opts: { body?: string; id?: string; ts?: number; secret?: string; sigPrefix?: string } = {}): Promise<{ headers: Record<string, string>; rawBody: string }> {
  const body = opts.body ?? JSON.stringify(testEvent());
  const id = opts.id ?? "8f1c2a4e-6b3d-4e8f-9a2b-1c5d7e9f0a3b";
  const ts = String(opts.ts ?? NOW);
  const sig = await testSign(opts.secret ?? SECRET_BYTES, id, ts, body);
  return {
    headers: { "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": (opts.sigPrefix ?? "v1,") + sig },
    rawBody: body,
  };
}

async function reasonOf(req: { headers: Record<string, string>; rawBody: string }, now = NOW): Promise<string> {
  const result = await verifyWebhook(req, SECRET, now);
  return result.ok ? "ok" : result.reason;
}

// ------------------------------------------------------------------ part 1

test(1, "a correctly signed delivery verifies and parses", async () => {
  const result = await verifyWebhook(await signedDelivery(), SECRET, NOW);
  assertEqual(result, { ok: true, event: testEvent() });
});

test(1, "a tampered body fails the signature", async () => {
  const req = await signedDelivery();
  req.rawBody = req.rawBody.replace("not_1d3tmYTlCICgjy", "not_AAAAAAAAAAAAAA");
  assertEqual(await reasonOf(req), "bad_signature");
});

test(1, "a tampered id or timestamp fails the signature", async () => {
  const a = await signedDelivery();
  a.headers["webhook-timestamp"] = String(NOW + 1);
  const b = await signedDelivery();
  b.headers["webhook-id"] = "someone-elses-event";
  assertEqual([await reasonOf(a), await reasonOf(b)], ["bad_signature", "bad_signature"]);
});

test(1, "the wrong secret fails the signature", async () => {
  const req = await signedDelivery({ secret: btoa("a different key entirely") });
  assertEqual(await reasonOf(req), "bad_signature");
});

test(1, "any matching v1 signature is enough (secret rotation)", async () => {
  const req = await signedDelivery();
  const good = req.headers["webhook-signature"];
  req.headers["webhook-signature"] = "v1,AAAAbm90IGl0AAAA " + good;
  assertEqual(await reasonOf(req), "ok");
});

test(1, "non-v1 signatures are ignored, even if the bytes match", async () => {
  assertEqual(await reasonOf(await signedDelivery({ sigPrefix: "v2," })), "bad_signature");
  assertEqual(await reasonOf(await signedDelivery({ sigPrefix: "v1a," })), "bad_signature");
});

test(1, "garbage signature headers are rejected, not thrown", async () => {
  for (const junk of ["v1", ",", "v1,", "   "]) {
    const req = await signedDelivery();
    req.headers["webhook-signature"] = junk;
    const reason = await reasonOf(req);
    assert(reason === "bad_signature" || reason === "missing_headers", JSON.stringify(junk) + " gave " + reason);
  }
});

test(1, "missing headers are reported as such", async () => {
  for (const header of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
    const req = await signedDelivery();
    delete req.headers[header];
    assertEqual(await reasonOf(req), "missing_headers", "without " + header);
  }
});

test(1, "timestamps outside the tolerance are stale, in both directions", async () => {
  const req = await signedDelivery();
  assertEqual(
    [await reasonOf(req, NOW + 300), await reasonOf(req, NOW + 301), await reasonOf(req, NOW - 300), await reasonOf(req, NOW - 301)],
    ["ok", "stale", "ok", "stale"]);
  assertEqual(await verifyWebhook(req, SECRET, NOW + 61, 60), { ok: false, reason: "stale" });
});

test(1, "a forged, stale request is reported as a bad signature", async () => {
  const req = await signedDelivery({ secret: btoa("attacker") });
  assertEqual(await reasonOf(req, NOW + 10_000), "bad_signature");
});

test(1, "signed but malformed bodies are malformed_body", async () => {
  const bodies = [
    "{not json",
    JSON.stringify(testEvent({ event_type: "note.deleted" })),
    JSON.stringify(testEvent({ note_id: 42 })),
    JSON.stringify(testEvent({ event_type: "note.edited" })), // edited needs data.changed_fields
    JSON.stringify(testEvent({ event_id: "not-the-header-id" })),
    "null",
  ];
  for (const body of bodies) assertEqual(await reasonOf(await signedDelivery({ body })), "malformed_body", body);
});

test(1, "note.edited carries its changed_fields through", async () => {
  const event = testEvent({ event_type: "note.edited", data: { changed_fields: ["summary"] } });
  const result = await verifyWebhook(await signedDelivery({ body: JSON.stringify(event) }), SECRET, NOW);
  assertEqual(result, { ok: true, event });
});

// ------------------------------------------------------------------ part 2

function ev(id: string, type: "note.generated" | "note.access_granted" = "note.generated") {
  return { event_id: id, event_type: type, note_id: "not_1d3tmYTlCICgjy", occurred_at: "2026-01-27T15:30:00Z" };
}

function edited(id: string, fields: string[]) {
  return { event_id: id, event_type: "note.edited" as const, note_id: "not_1d3tmYTlCICgjy",
           occurred_at: "2026-01-27T15:30:00Z", data: { changed_fields: fields } };
}

test(2, "routes each event to its type's handlers, in registration order", async () => {
  const log: string[] = [];
  const router = new WebhookRouter()
    .on("note.generated", (e) => { log.push("gen1:" + e.event_id); })
    .on("note.edited", (e) => { log.push("edit:" + e.data.changed_fields.join()); })
    .on("note.generated", async (e) => { await null; log.push("gen2:" + e.event_id); });
  assertEqual(await router.handle(ev("a")), "handled");
  assertEqual(await router.handle(edited("b", ["summary"])), "handled");
  assertEqual(log, ["gen1:a", "gen2:a", "edit:summary"]);
});

test(2, "handlers run one after another, not concurrently", async () => {
  const log: string[] = [];
  const router = new WebhookRouter()
    .on("note.generated", async () => { log.push("1 start"); await null; await null; log.push("1 end"); })
    .on("note.generated", () => { log.push("2"); });
  await router.handle(ev("a"));
  assertEqual(log, ["1 start", "1 end", "2"]);
});

test(2, "no handler for the type means ignored", async () => {
  const router = new WebhookRouter().on("note.edited", () => {});
  assertEqual(await router.handle(ev("a", "note.access_granted")), "ignored");
});

test(2, "a redelivered event is a duplicate and doesn't run twice", async () => {
  let calls = 0;
  const router = new WebhookRouter().on("note.generated", () => { calls++; });
  assertEqual([await router.handle(ev("a")), await router.handle(ev("a")), await router.handle(ev("b"))],
              ["handled", "duplicate", "handled"]);
  assertEqual(calls, 2);
});

test(2, "a throwing handler rejects and leaves the event retryable", async () => {
  let attempts = 0;
  const router = new WebhookRouter().on("note.generated", () => {
    attempts++;
    if (attempts === 1) throw new Error("database is down");
  });
  await assertRejects(() => router.handle(ev("a")), "database is down");
  assertEqual(await router.handle(ev("a")), "handled");
  assertEqual(attempts, 2);
});

test(2, "concurrent duplicates run handlers once", async () => {
  let calls = 0;
  const router = new WebhookRouter().on("note.generated", async () => { calls++; for (let i = 0; i < 5; i++) await null; });
  const outcomes = await Promise.all([router.handle(ev("a")), router.handle(ev("a")), router.handle(ev("a"))]);
  assertEqual([calls, outcomes], [1, ["handled", "duplicate", "duplicate"]]);
});

test(2, "a concurrent duplicate of a failing event fails too", async () => {
  let calls = 0;
  const router = new WebhookRouter().on("note.generated", async () => { calls++; await null; throw new Error("boom"); });
  const first = router.handle(ev("a"));
  const second = router.handle(ev("a"));
  await assertRejects(() => first, "boom");
  await assertRejects(() => second, "boom");
  assertEqual(calls, 1);
});

test(2, "handler parameters are narrowed to their event type", () => {
  const router = new WebhookRouter();
  router.on("note.edited", (e) => { const fields: string[] = e.data.changed_fields; void fields; });
  // @ts-expect-error - note.generated events have no data
  router.on("note.generated", (e) => e.data);
  // @ts-expect-error - Granola doesn't send note.deleted
  router.on("note.deleted", () => {});
  const chained: WebhookRouter = router.on("note.access_granted", (e) => { const id: string = e.note_id; void id; });
  void chained;
});

// ------------------------------------------------------------------ part 3

async function flush() {
  for (let i = 0; i < 25; i++) await null;
}

/** A fetchNote whose calls you settle by hand. Each call returns the note at the current version.
 *  (Helpers outside test() spell types out structurally, so Part 1 compiles before SyncedNote exists.) */
function manualFetcher() {
  const calls: { id: string; resolve: () => void; reject: (e: unknown) => void }[] = [];
  const versions = new Map<string, number>();
  const fetchNote = (id: string) =>
    new Promise<{ id: string; version: number }>((resolve, reject) => {
      const version = (versions.get(id) ?? 0) + 1;
      versions.set(id, version);
      calls.push({ id, resolve: () => resolve({ id, version }), reject });
    });
  const saved: string[] = [];
  const save = (note: { id: string; version: number }) => { saved.push(note.id + "@v" + note.version); };
  return { calls, fetchNote, save, saved };
}

test(3, "one notify, one fetch, one save", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  let done = false;
  const p = syncer.notify("n1").then(() => { done = true; });
  await flush();
  assertEqual([f.calls.length, done], [1, false]);
  f.calls[0].resolve();
  await p;
  assertEqual(f.saved, ["n1@v1"]);
});

test(3, "a burst during a fetch coalesces into one follow-up", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  const first = syncer.notify("n1");
  await flush();
  const burst = [syncer.notify("n1"), syncer.notify("n1"), syncer.notify("n1"), syncer.notify("n1")];
  await flush();
  assertEqual(f.calls.length, 1, "no second fetch while the first is in flight");
  f.calls[0].resolve();
  await first;
  await flush();
  assertEqual(f.calls.length, 2, "exactly one follow-up");
  f.calls[1].resolve();
  await Promise.all(burst);
  assertEqual(f.saved, ["n1@v1", "n1@v2"]);
});

test(3, "a notify that joined late waits for the follow-up, not the running fetch", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  void syncer.notify("n1");
  await flush();
  let lateDone = false;
  const late = syncer.notify("n1").then(() => { lateDone = true; });
  f.calls[0].resolve();
  await flush();
  assertEqual(lateDone, false, "the in-flight fetch may have read the note before this edit");
  f.calls[1].resolve();
  await late;
});

test(3, "different notes fetch in parallel", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  void syncer.notify("n1");
  void syncer.notify("n2");
  void syncer.notify("n3");
  await flush();
  assertEqual(f.calls.map((c) => c.id), ["n1", "n2", "n3"]);
});

test(3, "a notify after everything settled starts a fresh fetch", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  const a = syncer.notify("n1");
  await flush();
  f.calls[0].resolve();
  await a;
  const b = syncer.notify("n1");
  await flush();
  assertEqual(f.calls.length, 2);
  f.calls[1].resolve();
  await b;
  assertEqual(f.saved, ["n1@v1", "n1@v2"]);
});

test(3, "a failed fetch rejects its waiters, saves nothing, and doesn't wedge the note", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  const a = syncer.notify("n1");
  await flush();
  f.calls[0].reject(new Error("503 from the API"));
  await assertRejects(() => a, "503 from the API");
  assertEqual(f.saved, []);
  const b = syncer.notify("n1");
  await flush();
  f.calls[1].resolve();
  await b;
  assertEqual(f.saved, ["n1@v2"]);
});

test(3, "a queued follow-up still runs after the fetch before it fails", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  const a = syncer.notify("n1");
  await flush();
  const b = syncer.notify("n1");
  f.calls[0].reject(new Error("timeout"));
  await assertRejects(() => a, "timeout");
  await flush();
  f.calls[1].resolve();
  await b;
  assertEqual(f.saved, ["n1@v2"]);
});

test(3, "idle() waits for in-flight and queued work, failures included", async () => {
  const f = manualFetcher();
  const syncer = new NoteSyncer(f.fetchNote, f.save);
  await syncer.idle();
  const a = syncer.notify("n1");
  a.catch(() => {});
  void syncer.notify("n2");
  await flush();
  void syncer.notify("n2");
  let idle = false;
  const waiting = syncer.idle().then(() => { idle = true; });
  f.calls[0].reject(new Error("nope"));
  f.calls[1].resolve();
  await flush();
  assertEqual(idle, false, "n2's follow-up is still queued");
  f.calls[2].resolve();
  await waiting;
  assertEqual(f.saved, ["n2@v1", "n2@v2"]);
});
