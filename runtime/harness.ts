/* Wololoop TypeScript test harness.
 *
 * Compiled together with your code and the tests into one global scope, so
 * tests call your functions and classes by name - no imports, no exports.
 *
 * You get these for free:
 *
 *   test(n, name, fn)              a test for Part n; fn may be async
 *   assertEqual(got, want, msg?)   deep equality (arrays, objects, Map, Set, Date)
 *   assertThrows(fn, match?)       fn throws; match is a class, string or RegExp
 *   assertRejects(fn, match?)      async version: fn's promise rejects
 *   assert(cond, msg?)             plain truthiness
 *   NotImplementedError            throw it from a stub - the test shows as "todo"
 *   main(fn)                       fn runs on Run (Ctrl+Enter), never under Run Tests -
 *                                  TypeScript's `if __name__ == "__main__"`
 */

type TestBody = () => void | Promise<void>;
type ErrorMatch = string | RegExp | (abstract new (...args: never[]) => Error);

class NotImplementedError extends Error {
  constructor(what = "") {
    super(what);
    this.name = "NotImplementedError";
  }
}

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

const __TESTS: { stage: number; name: string; fn: TestBody }[] = [];
const __TEST_TIMEOUT_MS = 2000;

const __MAINS: (() => unknown)[] = [];

function main(fn: () => unknown): void {
  __MAINS.push(fn);
}

function test(stage: number, name: string, fn: TestBody): void {
  __TESTS.push({ stage, name, fn });
}

function assert(condition: unknown, message = "assertion failed"): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertEqual(got: unknown, want: unknown, message = ""): void {
  if (__deepEqual(got, want)) return;
  const parts: string[] = [];
  if (message) parts.push(message);
  parts.push("expected:\n" + __indent(__show(want)));
  parts.push("     got:\n" + __indent(__show(got)));
  const hint = __firstDifference(got, want, "");
  if (hint) parts.push("first difference: " + hint);
  throw new AssertionError(parts.join("\n"));
}

function assertThrows(fn: () => unknown, match?: ErrorMatch): unknown {
  try {
    fn();
  } catch (err) {
    __checkError(err, match);
    return err;
  }
  throw new AssertionError("expected an error to be thrown, but nothing was" + __matchNote(match));
}

async function assertRejects(fn: () => Promise<unknown>, match?: ErrorMatch): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    __checkError(err, match);
    return err;
  }
  throw new AssertionError("expected the promise to reject, but it resolved" + __matchNote(match));
}

/* ------------------------------------------------------------ internals */

function __matchNote(match?: ErrorMatch): string {
  if (match === undefined) return "";
  if (typeof match === "function") return " (wanted " + match.name + ")";
  return " (wanted a message matching " + String(match) + ")";
}

function __checkError(err: unknown, match?: ErrorMatch): void {
  if (err instanceof NotImplementedError) throw err;
  if (match === undefined) return;
  if (typeof match === "function") {
    if (err instanceof match) return;
    const name = err instanceof Error ? err.constructor.name : typeof err;
    throw new AssertionError("expected " + match.name + " to be thrown, got " + name + ": " + __message(err));
  }
  const text = __message(err);
  const ok = typeof match === "string" ? text.includes(match) : match.test(text);
  if (!ok) throw new AssertionError("error message " + JSON.stringify(text) + " does not match " + String(match));
}

function __message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function __deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [k, v] of a) if (!b.has(k) || !__deepEqual(v, b.get(k))) return false;
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  const ka = Object.keys(a).filter((k) => (a as Record<string, unknown>)[k] !== undefined);
  const kb = Object.keys(b).filter((k) => (b as Record<string, unknown>)[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    Object.prototype.hasOwnProperty.call(b, k) &&
    __deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

function __firstDifference(got: unknown, want: unknown, path: string): string {
  if (__deepEqual(got, want)) return "";
  const here = path || "(top level)";
  if (Array.isArray(got) && Array.isArray(want)) {
    for (let i = 0; i < Math.min(got.length, want.length); i++) {
      const inner = __firstDifference(got[i], want[i], path + "[" + i + "]");
      if (inner) return inner;
    }
    return "at " + here + ": length " + got.length + ", expected " + want.length;
  }
  if (got && want && typeof got === "object" && typeof want === "object" &&
      !(got instanceof Map) && !(got instanceof Set) && !(got instanceof Date)) {
    const g = got as Record<string, unknown>;
    const w = want as Record<string, unknown>;
    for (const k of Object.keys(w)) {
      if (w[k] !== undefined && !(k in g)) return "missing key " + JSON.stringify(k) + " at " + here;
      const inner = __firstDifference(g[k], w[k], path + "." + k);
      if (inner) return inner;
    }
    for (const k of Object.keys(g)) {
      if (g[k] !== undefined && !(k in w)) return "unexpected key " + JSON.stringify(k) + " at " + here;
    }
    return "";
  }
  if (!path) return "";
  return "at " + path + ": expected " + __show(want, 120) + ", got " + __show(got, 120);
}

function __show(value: unknown, limit = 700): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown, depth: number): string => {
    if (v === undefined) return "undefined";
    if (typeof v === "bigint") return v + "n";
    if (typeof v === "string") return JSON.stringify(v);
    if (typeof v === "function") return "[Function " + (v.name || "anonymous") + "]";
    if (typeof v !== "object" || v === null) return String(v);
    if (seen.has(v)) return "[Circular]";
    seen.add(v);
    const pad = "  ".repeat(depth + 1);
    const close = "  ".repeat(depth);
    const block = (open: string, items: string[], end: string) =>
      items.length === 0 ? open + end
        : items.join(", ").length < 60 ? open + items.join(", ") + end
        : open + "\n" + items.map((i) => pad + i).join(",\n") + "\n" + close + end;
    if (v instanceof Date) return "Date(" + v.toISOString() + ")";
    if (v instanceof Error) return v.name + "(" + JSON.stringify(v.message) + ")";
    if (Array.isArray(v)) return block("[", v.map((x) => walk(x, depth + 1)), "]");
    if (v instanceof Map) return block("Map {", [...v].map(([k, x]) => walk(k, depth + 1) + " => " + walk(x, depth + 1)), "}");
    if (v instanceof Set) return block("Set {", [...v].map((x) => walk(x, depth + 1)), "}");
    const name = v.constructor && v.constructor !== Object ? v.constructor.name + " " : "";
    const entries = Object.entries(v).filter(([, x]) => x !== undefined)
      .map(([k, x]) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ": " + walk(x, depth + 1));
    return name + block("{", entries, "}");
  };
  const text = walk(value, 0);
  return text.length > limit ? text.slice(0, limit) + "\n  ...(truncated)" : text;
}

function __indent(text: string): string {
  return text.split("\n").map((l) => "    " + l).join("\n");
}

type __Row = { name: string; func: string; stage: number; status: string; message: string; ms: number };

async function __wololoopRun(stages: number[] | null, clean: (err: unknown) => string): Promise<__Row[]> {
  const rows: __Row[] = [];
  for (const t of __TESTS) {
    if (stages && !stages.includes(t.stage)) continue;
    const started = Date.now();
    let status = "pass";
    let message = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.resolve().then(t.fn),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new __Timeout()), __TEST_TIMEOUT_MS);
        }),
      ]);
    } catch (err) {
      if (err instanceof NotImplementedError) {
        status = "todo";
        message = "not implemented yet" + (err.message ? ": " + err.message : "");
      } else if (err instanceof AssertionError) {
        status = "fail";
        message = err.message;
      } else if (err instanceof __Timeout) {
        status = "error";
        message = "did not finish within " + __TEST_TIMEOUT_MS / 1000 + "s - a promise that never settles, " +
          "or a real sleep where an injected one belongs?";
      } else {
        status = "error";
        message = clean(err);
      }
    } finally {
      clearTimeout(timer);
    }
    rows.push({ name: t.name, func: t.name, stage: t.stage, status, message, ms: Date.now() - started });
  }
  return rows;
}

class __Timeout extends Error {}

async function __wololoopMain(clean: (err: unknown) => string): Promise<string | null> {
  for (const fn of __MAINS) {
    try {
      await fn();
    } catch (err) {
      return clean(err);
    }
  }
  return null;
}
