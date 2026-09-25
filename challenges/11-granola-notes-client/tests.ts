// Tests for 11 - Granola Notes API Client.

function fakeId(prefix: string, n: number): string {
  return prefix + "_" + String(n).padStart(14, "0");
}

function fakeSummary(n: number) {
  return {
    id: fakeId("not", n),
    object: "note" as const,
    title: "Meeting " + n,
    owner: { name: "Oat Benson", email: "oat@granola.ai" },
    created_at: "2026-01-" + String(1 + (n % 28)).padStart(2, "0") + "T09:00:00Z",
    updated_at: "2026-02-01T09:00:00Z",
  };
}

function fakeTranscriptLine(n: number) {
  return {
    speaker: { source: "speaker" as const, attribution: "them" as const },
    text: "line " + n,
    start_time: "2026-01-27T15:30:" + String(n % 60).padStart(2, "0") + "Z",
    end_time: "2026-01-27T15:30:" + String(n % 60).padStart(2, "0") + "Z",
  };
}

type FakeReply = { status: number; headers?: Record<string, string>; body?: unknown } | Error;

/* Plays the Granola API. `failNext` queues replies that pre-empt the real one. */
class FakeGranola {
  readonly requests: { method: string; path: string; query: Record<string, string> }[] = [];
  readonly failNext: FakeReply[] = [];
  readonly hugeTranscripts = new Set<string>();
  inFlight = 0;
  maxInFlight = 0;
  tickDelay: (path: string) => number = () => 0;

  constructor(readonly notes = Array.from({ length: 7 }, (_, i) => fakeSummary(i + 1)),
              readonly transcriptLength = 3) {}

  transport = async (req: { method: "GET"; path: string; query: Record<string, string> }) => {
    this.requests.push({ method: req.method, path: req.path, query: { ...req.query } });
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      for (let i = 0; i < this.tickDelay(req.path); i++) await null;
      const scripted = this.failNext.shift();
      if (scripted instanceof Error) throw scripted;
      if (scripted) return { status: scripted.status, headers: scripted.headers ?? {}, body: scripted.body ?? {} };
      return this.route(req.path, req.query);
    } finally {
      this.inFlight--;
    }
  };

  private page<T>(items: T[], query: Record<string, string>, key: string, max: number) {
    const size = Number(query.page_size ?? 10);
    if (!(size >= 1 && size <= max)) return { status: 400, headers: {}, body: { code: "BAD_REQUEST" } };
    const offset = query.cursor ? Number(atob(query.cursor)) : 0;
    const slice = items.slice(offset, offset + size);
    const more = offset + size < items.length;
    return { status: 200, headers: {}, body: { [key]: slice, hasMore: more, cursor: more ? btoa(String(offset + size)) : null } };
  }

  private route(path: string, query: Record<string, string>) {
    if (path === "/v1/notes") return this.page(this.notes, query, "notes", 30);
    const m = /^\/v1\/notes\/([^/]+)(\/transcript)?$/.exec(path);
    const note = m && this.notes.find((n) => n.id === m[1]);
    if (!m || !note) return { status: 404, headers: {}, body: { code: "NOT_FOUND" } };
    const lines = Array.from({ length: this.transcriptLength }, (_, i) => fakeTranscriptLine(i));
    if (m[2]) return this.page(lines, query, "transcript", 100);
    const full = { ...note, web_url: "https://notes.granola.ai/d/" + note.id, attendees: [note.owner],
                   summary_markdown: "## " + note.title };
    if (query.include === "transcript") {
      if (this.hugeTranscripts.has(note.id)) return { status: 413, headers: {}, body: { code: "TRANSCRIPT_TOO_LARGE" } };
      return { status: 200, headers: {}, body: { ...full, transcript: lines } };
    }
    return { status: 200, headers: {}, body: full };
  }
}

async function drain<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of iter) out.push(x);
  return out;
}

function recordingSleep() {
  const calls: number[] = [];
  return { calls, sleep: async (ms: number) => { calls.push(ms); } };
}

// ------------------------------------------------------------------ part 1

test(1, "yields every note across pages, in order", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport, pageSize: 3 });
  const notes = await drain(client.listNotes());
  assertEqual(notes.map((n) => n.id), server.notes.map((n) => n.id));
  assertEqual(server.requests.length, 3, "7 notes at 3 per page is 3 requests");
});

test(1, "passes the previous page's cursor back", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport, pageSize: 3 });
  await drain(client.listNotes());
  assertEqual(server.requests.map((r) => r.query.cursor), [undefined, btoa("3"), btoa("6")]);
  assertEqual(server.requests.map((r) => r.path), ["/v1/notes", "/v1/notes", "/v1/notes"]);
});

test(1, "maps filters to snake_case query params", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport, pageSize: 30 });
  await drain(client.listNotes({ createdAfter: "2026-01-01", createdBefore: "2026-02-01",
                                 updatedAfter: "2026-01-15T00:00:00Z", folderId: "fol_4y6LduVdwSKC27" }));
  assertEqual(server.requests[0].query, {
    created_after: "2026-01-01", created_before: "2026-02-01", updated_after: "2026-01-15T00:00:00Z",
    folder_id: "fol_4y6LduVdwSKC27", page_size: "30",
  });
});

test(1, "undefined filters are left out, not sent as \"undefined\"", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  await drain(client.listNotes({ folderId: undefined, createdAfter: "2026-01-01" }));
  const query = server.requests[0].query;
  assertEqual(Object.keys(query).sort(), ["created_after", "page_size"]);
  assertEqual(query.page_size, "10", "page size defaults to 10 and is always sent");
});

test(1, "is lazy: breaking early stops fetching", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport, pageSize: 3 });
  const seen: string[] = [];
  for await (const note of client.listNotes()) {
    seen.push(note.id);
    if (seen.length === 3) break;
  }
  assertEqual(server.requests.length, 1, "page 2 should never have been requested");
});

test(1, "creating the iterator sends nothing until it's consumed", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  client.listNotes();
  await null;
  assertEqual(server.requests.length, 0);
});

test(1, "empty account yields nothing", async () => {
  const server = new FakeGranola([]);
  const client = new GranolaClient({ transport: server.transport });
  assertEqual(await drain(client.listNotes()), []);
});

test(1, "rejects a page size outside 1-30 at construction", () => {
  const transport = new FakeGranola().transport;
  assertThrows(() => new GranolaClient({ transport, pageSize: 0 }), RangeError);
  assertThrows(() => new GranolaClient({ transport, pageSize: 31 }), RangeError);
  assertThrows(() => new GranolaClient({ transport, pageSize: 2.5 }), RangeError);
  new GranolaClient({ transport, pageSize: 1 });
  new GranolaClient({ transport, pageSize: 30 });
});

test(1, "a non-2xx response throws GranolaApiError with its status", async () => {
  const server = new FakeGranola();
  server.failNext.push({ status: 401, body: { code: "UNAUTHORIZED" } });
  const client = new GranolaClient({ transport: server.transport });
  const err = await assertRejects(() => drain(client.listNotes()), GranolaApiError);
  assertEqual((err as GranolaApiError).status, 401);
});

test(1, "hasMore with a null cursor throws instead of looping", async () => {
  const server = new FakeGranola();
  server.failNext.push({ status: 200, body: { notes: [fakeSummary(1)], hasMore: true, cursor: null } });
  const client = new GranolaClient({ transport: server.transport });
  await assertRejects(() => drain(client.listNotes()), GranolaApiError);
  assert(server.requests.length === 1, "should stop after the bad page, made " + server.requests.length + " requests");
});

// ------------------------------------------------------------------ part 2

test(2, "retries a 429 and carries on", async () => {
  const server = new FakeGranola();
  const { calls, sleep } = recordingSleep();
  server.failNext.push({ status: 429 });
  const client = new GranolaClient({ transport: server.transport, sleep, pageSize: 10 });
  assertEqual((await drain(client.listNotes())).length, 7);
  assertEqual(calls, [250]);
});

test(2, "backs off exponentially from baseDelayMs", async () => {
  const server = new FakeGranola();
  const { calls, sleep } = recordingSleep();
  server.failNext.push({ status: 503 }, { status: 500 }, { status: 502 });
  const client = new GranolaClient({ transport: server.transport, sleep, retry: { maxAttempts: 4, baseDelayMs: 100 } });
  await drain(client.listNotes());
  assertEqual(calls, [100, 200, 400]);
});

test(2, "retry-after (seconds) beats the formula", async () => {
  const server = new FakeGranola();
  const { calls, sleep } = recordingSleep();
  server.failNext.push({ status: 429, headers: { "retry-after": "3" } }, { status: 503 });
  const client = new GranolaClient({ transport: server.transport, sleep });
  await drain(client.listNotes());
  assertEqual(calls, [3000, 500]);
});

test(2, "network errors are retried", async () => {
  const server = new FakeGranola();
  const { sleep } = recordingSleep();
  server.failNext.push(new TypeError("fetch failed"));
  const client = new GranolaClient({ transport: server.transport, sleep });
  assertEqual((await drain(client.listNotes())).length, 7);
});

test(2, "other 4xx are not retried", async () => {
  for (const status of [400, 401, 403, 404]) {
    const server = new FakeGranola();
    const { calls, sleep } = recordingSleep();
    server.failNext.push({ status });
    const client = new GranolaClient({ transport: server.transport, sleep });
    const err = (await assertRejects(() => drain(client.listNotes()), GranolaApiError)) as GranolaApiError;
    assertEqual([server.requests.length, calls.length, err.retryable, err.attempts], [1, 0, false, 1], "status " + status);
  }
});

test(2, "gives up after maxAttempts total and throws the last error", async () => {
  const server = new FakeGranola();
  const { calls, sleep } = recordingSleep();
  server.failNext.push({ status: 503 }, { status: 503 }, { status: 429 });
  const client = new GranolaClient({ transport: server.transport, sleep, retry: { maxAttempts: 3 } });
  const err = (await assertRejects(() => drain(client.listNotes()), GranolaApiError)) as GranolaApiError;
  assertEqual([server.requests.length, calls.length], [3, 2]);
  assertEqual([err.status, err.code, err.retryable, err.attempts], [429, "rate_limited", true, 3]);
});

test(2, "a retried page reuses its cursor: nothing skipped or duplicated", async () => {
  const server = new FakeGranola();
  const { sleep } = recordingSleep();
  const client = new GranolaClient({ transport: server.transport, sleep, pageSize: 3 });
  const ids: string[] = [];
  for await (const note of client.listNotes()) {
    ids.push(note.id);
    if (ids.length === 3) server.failNext.push({ status: 502 });
  }
  assertEqual(ids, server.notes.map((n) => n.id));
  assertEqual(server.requests[1].query.cursor, server.requests[2].query.cursor, "the retry must resend page 2's cursor");
});

test(2, "error codes map from status", async () => {
  const cases: [FakeReply, string, number | null][] = [
    [{ status: 400 }, "bad_request", 400],
    [{ status: 401 }, "unauthorized", 401],
    [{ status: 404 }, "not_found", 404],
    [{ status: 418 }, "unknown", 418],
    [new TypeError("socket hang up"), "network", null],
  ];
  for (const [reply, code, status] of cases) {
    const server = new FakeGranola();
    for (let i = 0; i < 4; i++) server.failNext.push(reply);
    const client = new GranolaClient({ transport: server.transport, sleep: async () => {} });
    const err = (await assertRejects(() => drain(client.listNotes()), GranolaApiError)) as GranolaApiError;
    assertEqual([err.code, err.status], [code, status]);
  }
});

test(2, "408 is retryable even though it's a 4xx", async () => {
  const server = new FakeGranola();
  server.failNext.push({ status: 408 });
  const client = new GranolaClient({ transport: server.transport, sleep: async () => {} });
  assertEqual((await drain(client.listNotes())).length, 7);
});

test(2, "code is a closed string-literal union, not string", () => {
  const err = null as unknown as GranolaApiError;
  const ok: typeof err.code = "rate_limited";
  // @ts-expect-error - "teapot" is not an ApiErrorCode, so this must not compile
  const nope: typeof err.code = "teapot";
  // @ts-expect-error - status is readonly
  if (err) err.status = 500;
  void ok; void nope;
});

// ------------------------------------------------------------------ part 3

const NOTE_3 = fakeId("not", 3);

test(3, "getNote with include=transcript on the happy path", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  const note = await client.getNote(NOTE_3, { include: "transcript" });
  assertEqual([note.id, note.transcript.length], [NOTE_3, 3]);
  assertEqual(server.requests, [{ method: "GET", path: "/v1/notes/" + NOTE_3, query: { include: "transcript" } }]);
});

test(3, "plain getNote sends no include", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  const note = await client.getNote(NOTE_3);
  assertEqual([note.id, note.web_url], [NOTE_3, "https://notes.granola.ai/d/" + NOTE_3]);
  assertEqual(server.requests[0].query, {});
});

test(3, "overloads: only the include form has .transcript in its type", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  const plain = await client.getNote(NOTE_3);
  const full = await client.getNote(NOTE_3, { include: "transcript" });
  const lines: string[] = full.transcript.map((t) => t.text);
  // @ts-expect-error - a plain note has no transcript
  plain.transcript;
  // @ts-expect-error - "attendees" is not an include option
  if (false as boolean) await client.getNote(NOTE_3, { include: "attendees" });
  assertEqual(lines, ["line 0", "line 1", "line 2"]);
});

test(3, "TRANSCRIPT_TOO_LARGE falls back to the paged transcript endpoint", async () => {
  const server = new FakeGranola(undefined, 230);
  server.hugeTranscripts.add(NOTE_3);
  const client = new GranolaClient({ transport: server.transport, sleep: async () => {} });
  const note = await client.getNote(NOTE_3, { include: "transcript" });
  assertEqual(note.transcript.length, 230);
  assertEqual(note.transcript[229].text, "line 229");
  assertEqual(note.summary_markdown, "## Meeting 3");
  const paged = server.requests.filter((r) => r.path.endsWith("/transcript"));
  assertEqual(paged.map((r) => r.query.page_size), ["100", "100", "100"]);
  assertEqual(server.requests.length, 5, "413, plain note, then three transcript pages");
});

test(3, "a 413 is not retried", async () => {
  const server = new FakeGranola();
  server.hugeTranscripts.add(NOTE_3);
  const { calls, sleep } = recordingSleep();
  const client = new GranolaClient({ transport: server.transport, sleep });
  await client.getNote(NOTE_3, { include: "transcript" });
  assertEqual(calls, []);
});

test(3, "malformed ids throw TypeError before any request", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  for (const bad of ["not_123", "fol_00000000000003", "not_0000000000000!", "", "not_000000000000033"]) {
    await assertRejects(() => client.getNote(bad), TypeError);
  }
  assertEqual(server.requests.length, 0);
});

test(3, "getNotes keeps input order and caps concurrency", async () => {
  const server = new FakeGranola(Array.from({ length: 12 }, (_, i) => fakeSummary(i + 1)));
  server.tickDelay = (path) => 20 - Number(path.slice(-2)); // later ids finish first
  const client = new GranolaClient({ transport: server.transport });
  const ids = server.notes.map((n) => n.id);
  const results = await client.getNotes(ids, { concurrency: 3 });
  assertEqual(results.map((r) => r.id), ids);
  assert(results.every((r) => r.ok), "every note should have loaded");
  assertEqual(server.maxInFlight, 3);
});

test(3, "getNotes defaults to 4 in flight", async () => {
  const server = new FakeGranola(Array.from({ length: 10 }, (_, i) => fakeSummary(i + 1)));
  server.tickDelay = () => 5;
  const client = new GranolaClient({ transport: server.transport });
  await client.getNotes(server.notes.map((n) => n.id));
  assertEqual(server.maxInFlight, 4);
});

test(3, "one bad note becomes an ok:false entry, not a failed batch", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport, sleep: async () => {} });
  const missing = fakeId("not", 99);
  const results = await client.getNotes([fakeId("not", 1), missing, fakeId("not", 2)]);
  assertEqual(results.map((r) => r.ok), [true, false, true]);
  const failed = results[1];
  if (failed.ok) throw new AssertionError("expected the missing note to fail");
  assertEqual([failed.id, failed.error.code], [missing, "not_found"]);
  const first = results[0];
  // narrowing on .ok must give you .note with no cast
  if (first.ok) assertEqual(first.note.id, fakeId("not", 1));
  // @ts-expect-error - without narrowing, .note is not guaranteed to exist
  results[0].note;
});

test(3, "getNotes on an empty list makes no requests", async () => {
  const server = new FakeGranola();
  const client = new GranolaClient({ transport: server.transport });
  assertEqual(await client.getNotes([]), []);
  assertEqual(server.requests.length, 0);
});
