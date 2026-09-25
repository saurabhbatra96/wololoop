// Tests for 13 - Typed Endpoints for the Notes API.

/** "param:code" for every error, sorted - order of errors is not part of the contract. */
function errorCodes(result: { ok: boolean; errors?: { param: string; code: string }[] }): string[] {
  return result.ok ? [] : (result.errors ?? []).map((e) => e.param + ":" + e.code).sort();
}

const FOLDER = "fol_4y6LduVdwSKC27";

// ------------------------------------------------------------------ part 1

test(1, "an empty query gets the default page size", () => {
  assertEqual(parseListNotesQuery({}), { ok: true, value: { page_size: 10 } });
});

test(1, "every valid parameter parses", () => {
  const result = parseListNotesQuery({
    page_size: "30", created_after: "2026-01-01", created_before: "2026-01-27T15:30:00Z",
    updated_after: "2026-01-15T09:00:00.500+01:00", folder_id: FOLDER, cursor: "eyJjcmVkZW50aWFsfQ==",
  });
  assertEqual(result, { ok: true, value: {
    page_size: 30,
    created_after: new Date("2026-01-01T00:00:00Z"),
    created_before: new Date("2026-01-27T15:30:00Z"),
    updated_after: new Date("2026-01-15T08:00:00.500Z"),
    folder_id: FOLDER,
    cursor: "eyJjcmVkZW50aWFsfQ==",
  } });
});

test(1, "page_size must be digits only", () => {
  for (const bad of ["10.0", "1e1", " 5", "5 ", "", "-3", "ten", "0x10"]) {
    assertEqual(errorCodes(parseListNotesQuery({ page_size: bad })), ["page_size:invalid_integer"], JSON.stringify(bad));
  }
});

test(1, "page_size must be 1-30", () => {
  assertEqual(errorCodes(parseListNotesQuery({ page_size: "0" })), ["page_size:out_of_range"]);
  assertEqual(errorCodes(parseListNotesQuery({ page_size: "31" })), ["page_size:out_of_range"]);
  assertEqual(parseListNotesQuery({ page_size: "1" }), { ok: true, value: { page_size: 1 } });
});

test(1, "dates: date-only is midnight UTC; date-times need a zone", () => {
  const ok = parseListNotesQuery({ updated_after: "2026-01-27" });
  assertEqual(ok, { ok: true, value: { page_size: 10, updated_after: new Date(Date.UTC(2026, 0, 27)) } });
  for (const bad of ["2026-01-27T15:30:00", "27/01/2026", "2026-1-27", "yesterday", "2026-01-27 15:30:00Z", ""]) {
    assertEqual(errorCodes(parseListNotesQuery({ updated_after: bad })), ["updated_after:invalid_date"], JSON.stringify(bad));
  }
});

test(1, "dates that don't exist are rejected, not rolled over", () => {
  for (const bad of ["2026-02-30", "2026-13-01", "2025-02-29", "2026-04-31T10:00:00Z", "2026-01-27T24:00:00Z"]) {
    assertEqual(errorCodes(parseListNotesQuery({ created_after: bad })), ["created_after:invalid_date"], bad);
  }
  assertEqual(parseListNotesQuery({ created_after: "2028-02-29" }).ok, true, "2028 is a leap year");
});

test(1, "folder_id and cursor formats", () => {
  for (const bad of ["fol_4y6LduVdwSKC2", "fol_4y6LduVdwSKC277", "not_4y6LduVdwSKC27", "fol_4y6LduVdwSKC2!", ""]) {
    assertEqual(errorCodes(parseListNotesQuery({ folder_id: bad })), ["folder_id:invalid_format"], JSON.stringify(bad));
  }
  assertEqual(errorCodes(parseListNotesQuery({ cursor: "" })), ["cursor:invalid_format"]);
});

test(1, "unknown parameters are rejected by name", () => {
  assertEqual(errorCodes(parseListNotesQuery({ pagesize: "30", folderId: FOLDER })),
              ["folderId:unknown_parameter", "pagesize:unknown_parameter"]);
});

test(1, "every error is reported at once", () => {
  const result = parseListNotesQuery({ page_size: "100", created_after: "soon", folder_id: "x", colour: "blue" });
  assertEqual(errorCodes(result), ["colour:unknown_parameter", "created_after:invalid_date",
                                   "folder_id:invalid_format", "page_size:out_of_range"]);
  if (!result.ok) assert(result.errors.every((e) => e.message.length > 0), "every error needs a human message");
});

test(1, "created_after must be strictly before created_before", () => {
  assertEqual(errorCodes(parseListNotesQuery({ created_after: "2026-02-01", created_before: "2026-01-01" })),
              ["created_after:conflict"]);
  assertEqual(errorCodes(parseListNotesQuery({ created_after: "2026-01-27", created_before: "2026-01-27T00:00:00Z" })),
              ["created_after:conflict"], "equal instants conflict too");
  assertEqual(parseListNotesQuery({ created_after: "2026-01-27", created_before: "2026-01-27T00:00:01Z" }).ok, true);
});

// ------------------------------------------------------------------ part 2

test(2, "defaults, optionals and required fields at runtime", () => {
  const schema = { size: int({ min: 1, max: 5, default: 3 }), since: isoDate(), who: pattern(/^\w+$/, { required: true }) };
  assertEqual(parseQuery(schema, { who: "oat" }), { ok: true, value: { size: 3, who: "oat" } });
  assertEqual(errorCodes(parseQuery(schema, {})), ["who:missing"]);
});

test(2, "each builder validates", () => {
  const schema = { n: int({ min: 2, max: 4 }), d: isoDate(), p: pattern(/^a+$/), o: oneOf(["x", "y"]) };
  assertEqual(errorCodes(parseQuery(schema, { n: "5", d: "2026-02-30", p: "b", o: "z" })),
              ["d:invalid_date", "n:out_of_range", "o:invalid_format", "p:invalid_format"]);
  assertEqual(errorCodes(parseQuery(schema, { n: "2.0" })), ["n:invalid_integer"]);
  assertEqual(parseQuery(schema, { n: "4", d: "2026-01-27", p: "aaa", o: "y" }),
              { ok: true, value: { n: 4, d: new Date("2026-01-27T00:00:00Z"), p: "aaa", o: "y" } });
});

test(2, "required works on every builder", () => {
  const schema = { a: int({ required: true }), b: isoDate({ required: true }), c: oneOf(["on"], { required: true }) };
  assertEqual(errorCodes(parseQuery(schema, {})), ["a:missing", "b:missing", "c:missing"]);
});

test(2, "unknown parameters are rejected by parseQuery itself", () => {
  assertEqual(errorCodes(parseQuery({ a: int() }, { a: "1", b: "2" })), ["b:unknown_parameter"]);
});

test(2, "a default doesn't mask a bad value", () => {
  assertEqual(errorCodes(parseQuery({ size: int({ min: 1, max: 30, default: 10 }) }, { size: "99" })), ["size:out_of_range"]);
});

test(2, "InferQuery: defaults and required are present, the rest optional", () => {
  const schema = {
    page_size: int({ min: 1, max: 30, default: 10 }),
    created_after: isoDate(),
    folder_id: pattern(/^fol_/),
    include: oneOf(["transcript"]),
    owner: pattern(/@/, { required: true }),
  };
  type Q = InferQuery<typeof schema>;
  const full: Q = { page_size: 10, owner: "oat@granola.ai" };
  const n: number = full.page_size;
  const owner: string = full.owner;
  const inc: "transcript" | undefined = full.include;
  const d: Date | undefined = full.created_after;
  // @ts-expect-error - page_size has a default, so it is not optional
  const noSize: Q = { owner: "oat@granola.ai" };
  // @ts-expect-error - owner is required
  const noOwner: Q = { page_size: 10 };
  // @ts-expect-error - optional with no default: could be undefined
  const d2: Date = full.created_after;
  // @ts-expect-error - "attendees" is not in the oneOf list: a literal union, not string
  const inc2: Q["include"] = "attendees";
  // @ts-expect-error - not in the schema
  full.nope;
  void [n, owner, inc, d, noSize, noOwner, d2, inc2];
});

test(2, "parseQuery's success value is the inferred type", () => {
  const r = parseQuery({ size: int({ default: 5 }), tag: oneOf(["a", "b"]) }, { tag: "a" });
  if (!r.ok) throw new AssertionError("expected ok");
  const size: number = r.value.size;
  const tag: "a" | "b" | undefined = r.value.tag;
  // @ts-expect-error - tag may be undefined
  const tag2: "a" | "b" = r.value.tag;
  assertEqual([size, tag], [5, "a"]);
  void tag2;
});

test(2, "parseListNotesQuery is still typed after the refactor", () => {
  const r = parseListNotesQuery({});
  if (!r.ok) throw new AssertionError("expected ok");
  const size: number = r.value.page_size;
  const folder: string | undefined = r.value.folder_id;
  // @ts-expect-error - folder_id is optional
  const folder2: string = r.value.folder_id;
  void [size, folder, folder2];
});

// ------------------------------------------------------------------ part 3

/** @stage 3 - uses the Part 3 API, so it only has to compile once Part 3 is open */
function notesRouter() {
  const calls: string[] = [];
  const router = new Router()
    .get("/v1/notes/:note_id", {}, ({ params }) => {
      calls.push("note " + params.note_id);
      return { status: 200, body: { id: params.note_id } };
    })
    .get("/v1/notes/search", { q: pattern(/.+/, { required: true }) }, ({ query }) => {
      calls.push("search " + query.q);
      return { status: 200, body: { q: query.q } };
    })
    .get("/v1/notes/:note_id/transcript", { page_size: int({ min: 1, max: 100, default: 50 }) }, ({ params, query }) => ({
      status: 200, body: { id: params.note_id, size: query.page_size },
    }))
    .delete("/v1/webhook-endpoints/:id", {}, ({ params }) => ({ status: 200, body: { id: params.id, deleted: true } }))
    .get("/v1/boom", {}, () => { throw new Error("SELECT * FROM secrets failed"); });
  return { router, calls };
}

test(3, "routes by path and hands the handler decoded params", async () => {
  const { router } = notesRouter();
  assertEqual(await router.handle("GET", "/v1/notes/not_1d3tmYTlCICgjy"),
              { status: 200, body: { id: "not_1d3tmYTlCICgjy" } });
  assertEqual(await router.handle("GET", "/v1/notes/a%2Fb%20c"), { status: 200, body: { id: "a/b c" } });
});

test(3, "query goes through the route's schema, defaults included", async () => {
  const { router } = notesRouter();
  assertEqual(await router.handle("GET", "/v1/notes/n1/transcript"), { status: 200, body: { id: "n1", size: 50 } });
  assertEqual(await router.handle("GET", "/v1/notes/n1/transcript?page_size=100"), { status: 200, body: { id: "n1", size: 100 } });
});

test(3, "static segments beat params, whatever the order", async () => {
  const { router, calls } = notesRouter();
  await router.handle("GET", "/v1/notes/search?q=budget");
  assertEqual(calls, ["search budget"]);
  const reversed = new Router()
    .get("/v1/a/b", {}, () => ({ status: 200, body: "static" }))
    .get("/v1/:x/b", {}, () => ({ status: 200, body: "param" }));
  assertEqual((await reversed.handle("GET", "/v1/a/b")).body, "static");
  assertEqual((await reversed.handle("GET", "/v1/z/b")).body, "param");
});

test(3, "404 for unknown paths, including trailing slashes and empty params", async () => {
  const { router } = notesRouter();
  for (const url of ["/v1/folders", "/v1/notes/n1/", "/v1/notes//transcript", "/v1/notes/n1/transcript/extra"]) {
    assertEqual(await router.handle("GET", url), { status: 404, body: { error: "not_found" } }, url);
  }
});

test(3, "405 lists the allowed methods", async () => {
  const { router } = notesRouter();
  assertEqual(await router.handle("GET", "/v1/webhook-endpoints/whe_1"),
              { status: 405, body: { error: "method_not_allowed", allow: ["DELETE"] } });
  const both = new Router().get("/x", {}, () => ({ status: 200, body: 1 })).delete("/x", {}, () => ({ status: 200, body: 2 }));
  assertEqual(await both.handle("PATCH", "/x"), { status: 405, body: { error: "method_not_allowed", allow: ["DELETE", "GET"] } });
  assertEqual((await both.handle("DELETE", "/x")).body, 2);
});

test(3, "bad queries are a 400 with every error", async () => {
  const { router } = notesRouter();
  const res = await router.handle("GET", "/v1/notes/n1/transcript?page_size=500&colour=blue");
  assertEqual(res.status, 400);
  const body = res.body as { error: string; details: { param: string; code: string }[] };
  assertEqual(body.error, "invalid_request");
  assertEqual(errorCodes({ ok: false, errors: body.details }), ["colour:unknown_parameter", "page_size:out_of_range"]);
});

test(3, "a repeated query parameter is a duplicate_parameter error", async () => {
  const { router } = notesRouter();
  const res = await router.handle("GET", "/v1/notes/n1/transcript?page_size=5&page_size=6");
  const body = res.body as { error: string; details: { param: string; code: string }[] };
  assertEqual([res.status, body.error], [400, "invalid_request"]);
  assertEqual(errorCodes({ ok: false, errors: body.details }), ["page_size:duplicate_parameter"]);
});

test(3, "a missing required query parameter never reaches the handler", async () => {
  const { router, calls } = notesRouter();
  const res = await router.handle("GET", "/v1/notes/search");
  assertEqual(res.status, 400);
  assertEqual(calls, []);
});

test(3, "handler exceptions are a 500 that leaks nothing", async () => {
  const { router } = notesRouter();
  assertEqual(await router.handle("GET", "/v1/boom"), { status: 500, body: { error: "internal" } });
  const asyncBoom = new Router().get("/a", {}, async () => { await null; throw new Error("nope"); });
  assertEqual(await asyncBoom.handle("GET", "/a"), { status: 500, body: { error: "internal" } });
});

test(3, "PathParams is inferred from the path string", () => {
  type Two = PathParams<"/v1/folders/:folder_id/notes/:note_id">;
  const two: Two = { folder_id: "f", note_id: "n" };
  const none: PathParams<"/v1/notes"> = {};
  // @ts-expect-error - note_id is missing
  const missing: Two = { folder_id: "f" };
  // @ts-expect-error - no params in a static path
  none.id;
  void [two, none, missing];
});

test(3, "handlers see typed params and query", () => {
  new Router().get("/v1/notes/:note_id/transcript", { page_size: int({ default: 50 }), cursor: pattern(/.+/) },
    ({ params, query }) => {
      const id: string = params.note_id;
      const size: number = query.page_size;
      const cursor: string | undefined = query.cursor;
      // @ts-expect-error - the param is note_id, not id
      params.id;
      // @ts-expect-error - cursor is optional
      const c2: string = query.cursor;
      return { status: 200, body: [id, size, cursor, c2] };
    });
});
