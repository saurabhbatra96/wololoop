// 13 - Typed Endpoints for the Notes API: reference solution, all three parts.

type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E[] };

type ErrorCode =
  | "unknown_parameter"
  | "invalid_integer"
  | "out_of_range"
  | "invalid_date"
  | "invalid_format"
  | "conflict"
  | "missing"
  | "duplicate_parameter";

interface ValidationError {
  param: string;
  code: ErrorCode;
  message: string;
}

// ------------------------------------------------------------------ part 2: fields

type Parsed<T> = { ok: true; value: T } | { ok: false; code: ErrorCode; message: string };

/** `AlwaysPresent` is true when the parsed object always has this key: it's required or defaulted. */
interface Field<T, AlwaysPresent extends boolean> {
  readonly presence: AlwaysPresent extends true ? "required" | "default" : "optional";
  readonly defaultValue?: T;
  parse(raw: string): Parsed<T>;
}

type QuerySchema = Record<string, Field<unknown, boolean>>;
type FieldType<F> = F extends Field<infer T, boolean> ? T : never;
type Simplify<T> = { [K in keyof T]: T[K] } & {};

type InferQuery<S extends QuerySchema> = Simplify<
  { [K in keyof S as S[K] extends Field<unknown, true> ? K : never]: FieldType<S[K]> } &
  { [K in keyof S as S[K] extends Field<unknown, true> ? never : K]?: FieldType<S[K]> }
>;

const bad = (code: ErrorCode, message: string): Parsed<never> => ({ ok: false, code, message });

function field<T>(presence: "required" | "default" | "optional", parse: (raw: string) => Parsed<T>,
                  defaultValue?: T): Field<T, boolean> {
  return { presence, parse, defaultValue } as Field<T, boolean>;
}

const presenceOf = (opts: { required?: boolean; default?: unknown } | undefined) =>
  opts?.default !== undefined ? "default" : opts?.required ? "required" : "optional";

interface IntOptions { min?: number; max?: number; required?: boolean }

function int(opts: IntOptions & { default: number }): Field<number, true>;
function int(opts: IntOptions & { required: true }): Field<number, true>;
function int(opts?: IntOptions & { required?: false }): Field<number, false>;
function int(opts: IntOptions & { default?: number } = {}): Field<number, boolean> {
  return field(presenceOf(opts), (raw) => {
    if (!/^\d+$/.test(raw)) return bad("invalid_integer", "expected a whole number, got " + JSON.stringify(raw));
    const n = Number(raw);
    if ((opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max)) {
      return bad("out_of_range", "must be between " + opts.min + " and " + opts.max);
    }
    return { ok: true, value: n };
  }, opts.default);
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

function parseIsoDate(raw: string): Parsed<Date> {
  const dateOnly = DATE.exec(raw);
  const m = dateOnly || DATE_TIME.exec(raw);
  if (!m) return bad("invalid_date", "expected YYYY-MM-DD or an ISO 8601 date-time with a zone");
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return bad("invalid_date", raw + " is not a real date");
  }
  const value = new Date(dateOnly ? raw + "T00:00:00Z" : raw);
  return Number.isNaN(value.getTime()) ? bad("invalid_date", "unparseable date") : { ok: true, value };
}

function isoDate(opts: { required: true }): Field<Date, true>;
function isoDate(opts?: { required?: false }): Field<Date, false>;
function isoDate(opts?: { required?: boolean }): Field<Date, boolean> {
  return field(presenceOf(opts), parseIsoDate);
}

function pattern(re: RegExp, opts: { required: true }): Field<string, true>;
function pattern(re: RegExp, opts?: { required?: false }): Field<string, false>;
function pattern(re: RegExp, opts?: { required?: boolean }): Field<string, boolean> {
  return field(presenceOf(opts), (raw) => re.test(raw) ? { ok: true, value: raw }
    : bad("invalid_format", "does not match " + String(re)));
}

function oneOf<const V extends readonly string[]>(values: V, opts: { required: true }): Field<V[number], true>;
function oneOf<const V extends readonly string[]>(values: V, opts?: { required?: false }): Field<V[number], false>;
function oneOf<const V extends readonly string[]>(values: V, opts?: { required?: boolean }): Field<V[number], boolean> {
  return field<V[number]>(presenceOf(opts), (raw) => values.includes(raw)
    ? { ok: true, value: raw as V[number] }
    : bad("invalid_format", "must be one of " + values.join(", ")));
}

function parseQuery<S extends QuerySchema>(schema: S, raw: Record<string, string>): Result<InferQuery<S>, ValidationError> {
  const errors: ValidationError[] = [];
  const out: Record<string, unknown> = {};
  for (const param of Object.keys(raw)) {
    if (!Object.prototype.hasOwnProperty.call(schema, param)) {
      errors.push({ param, code: "unknown_parameter", message: "unknown parameter " + JSON.stringify(param) });
    }
  }
  for (const [param, spec] of Object.entries(schema)) {
    if (!Object.prototype.hasOwnProperty.call(raw, param)) {
      if (spec.presence === "default") out[param] = spec.defaultValue;
      else if (spec.presence === "required") errors.push({ param, code: "missing", message: param + " is required" });
      continue;
    }
    const parsed = spec.parse(raw[param]);
    if (parsed.ok) out[param] = parsed.value;
    else errors.push({ param, code: parsed.code, message: parsed.message });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value: out as InferQuery<S> };
}

// ------------------------------------------------------------------ part 1, rebuilt on part 2

const listNotesSchema = {
  page_size: int({ min: 1, max: 30, default: 10 }),
  created_after: isoDate(),
  created_before: isoDate(),
  updated_after: isoDate(),
  folder_id: pattern(/^fol_[a-zA-Z0-9]{14}$/),
  cursor: pattern(/^.+$/),
};

type ListNotesQuery = InferQuery<typeof listNotesSchema>;

function parseListNotesQuery(raw: Record<string, string>): Result<ListNotesQuery, ValidationError> {
  const result = parseQuery(listNotesSchema, raw);
  if (!result.ok) return result;
  const { created_after, created_before } = result.value;
  if (created_after && created_before && created_after.getTime() >= created_before.getTime()) {
    return { ok: false, errors: [{ param: "created_after", code: "conflict",
                                   message: "created_after must be before created_before" }] };
  }
  return result;
}

// ------------------------------------------------------------------ part 3

type ParamNames<P extends string> =
  P extends `${string}:${infer Name}/${infer Rest}` ? Name | ParamNames<Rest>
  : P extends `${string}:${infer Name}` ? Name
  : never;

type PathParams<P extends string> = Simplify<{ [K in ParamNames<P>]: string }>;

type ApiResult = { status: number; body: unknown };
type Handler<P extends string, S extends QuerySchema> =
  (req: { params: PathParams<P>; query: InferQuery<S> }) => ApiResult | Promise<ApiResult>;

interface Route {
  method: string;
  segments: string[];
  schema: QuerySchema;
  handler: (req: { params: Record<string, string>; query: unknown }) => ApiResult | Promise<ApiResult>;
}

class Router {
  private readonly routes: Route[] = [];

  get<P extends string, S extends QuerySchema>(path: P, query: S, handler: Handler<P, S>): this {
    return this.add("GET", path, query, handler);
  }

  delete<P extends string, S extends QuerySchema>(path: P, query: S, handler: Handler<P, S>): this {
    return this.add("DELETE", path, query, handler);
  }

  private add<P extends string, S extends QuerySchema>(method: string, path: P, schema: S, handler: Handler<P, S>): this {
    // Sound: handle() builds params from this route's own pattern and query from its own schema.
    this.routes.push({ method, segments: path.split("/"), schema, handler: handler as unknown as Route["handler"] });
    return this;
  }

  async handle(method: string, url: string): Promise<ApiResult> {
    const [path, qs = ""] = url.split("?", 2);
    const segments = path.split("/");

    const matches: { route: Route; params: Record<string, string> }[] = [];
    for (const route of this.routes) {
      const params = matchSegments(route.segments, segments);
      if (params) matches.push({ route, params });
    }
    if (!matches.length) return { status: 404, body: { error: "not_found" } };

    matches.sort((a, b) => specificity(a.route.segments, b.route.segments));
    const best = matches[0].route.segments.join("/");
    const samePattern = matches.filter((m) => m.route.segments.join("/") === best);
    const hit = samePattern.find((m) => m.route.method === method.toUpperCase());
    if (!hit) {
      const allow = Array.from(new Set(samePattern.map((m) => m.route.method))).sort();
      return { status: 405, body: { error: "method_not_allowed", allow } };
    }

    const raw: Record<string, string> = {};
    const errors: ValidationError[] = [];
    for (const [key, value] of new URLSearchParams(qs)) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        if (!errors.some((e) => e.param === key)) {
          errors.push({ param: key, code: "duplicate_parameter", message: key + " given more than once" });
        }
        continue;
      }
      raw[key] = value;
    }
    const parsed = parseQuery(hit.route.schema, raw);
    if (!parsed.ok) errors.push(...parsed.errors);
    if (errors.length || !parsed.ok) return { status: 400, body: { error: "invalid_request", details: errors } };

    try {
      return await hit.route.handler({ params: hit.params, query: parsed.value });
    } catch {
      return { status: 500, body: { error: "internal" } };
    }
  }
}

function matchSegments(pattern: string[], actual: string[]): Record<string, string> | null {
  if (pattern.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(":")) {
      if (!actual[i]) return null;
      try {
        params[pattern[i].slice(1)] = decodeURIComponent(actual[i]);
      } catch {
        return null;
      }
    } else if (pattern[i] !== actual[i]) {
      return null;
    }
  }
  return params;
}

/** Negative when `a` is more specific: the first segment where one is static and the other a param decides. */
function specificity(a: string[], b: string[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const pa = a[i].startsWith(":"), pb = b[i].startsWith(":");
    if (pa !== pb) return pa ? 1 : -1;
  }
  return 0;
}

main(async () => {
  console.log(parseListNotesQuery({ page_size: "5", created_after: "2026-01-27" }));
  console.log(parseListNotesQuery({ pagesize: "30", folder_id: "fol_nope" }));
  const router = new Router().get("/v1/notes/:note_id", {}, ({ params }) => ({ status: 200, body: params }));
  console.log(await router.handle("GET", "/v1/notes/not_1d3tmYTlCICgjy"));
});
