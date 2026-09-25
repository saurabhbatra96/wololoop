/* Web Worker: runs one compiled TypeScript program, then gets thrown away.
 *
 * A fresh worker per run is what gives each run a clean global scope - your
 * top-level `class` and `const` declarations would collide with the previous
 * run's otherwise. It is also how Stop and the timeout work: terminate it.
 * The three files load as separate classic scripts, which share one global
 * scope, so the tests see your declarations by name.
 */

importScripts("../runtime/tscompile.js");

const post = (msg) => self.postMessage(msg);
const blobNames = new Map();

function show(value) {
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || String(value);
  try {
    return JSON.stringify(value, (k, v) => (typeof v === "bigint" ? v + "n" : v instanceof Map ? Object.fromEntries(v)
      : v instanceof Set ? Array.from(v) : v));
  } catch (err) {
    return String(value);
  }
}

const printer = (isError) => (...args) => post({ type: isError ? "stderr" : "stdout", text: args.map(show).join(" ") + "\n" });
self.console = { log: printer(false), info: printer(false), debug: printer(false), table: printer(false),
                 warn: printer(true), error: printer(true) };

let maps = {};

function clean(err) {
  if (err && typeof err === "object" && typeof err.stack === "string") {
    let stack = err.stack;
    for (const [url, name] of blobNames) stack = stack.split(url).join(name);
    try {
      Object.defineProperty(err, "stack", { value: stack, configurable: true });
    } catch (ignored) { /* frozen error - fall back to the raw stack */ }
  }
  return TsCompile.cleanStack(err, maps);
}

self.onunhandledrejection = (event) => {
  post({ type: "stderr", text: "Unhandled promise rejection: " + clean(event.reason) + "\n" });
};

function load(source, name) {
  const url = URL.createObjectURL(new Blob([source + "\n//# sourceURL=" + name + "\n"], { type: "text/javascript" }));
  blobNames.set(url, name);
  importScripts(url);
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  maps = msg.maps || {};
  try {
    load(msg.js.harness, "harness.js");
  } catch (err) {
    post({ type: "done", payload: { ok: false, where: "runtime", error: clean(err) } });
    return;
  }
  try {
    load(msg.js.code, "your_code.js");
  } catch (err) {
    post({ type: "done", payload: { ok: false, where: "code", error: clean(err) } });
    return;
  }

  if (msg.mode === "run") {
    const failure = await self.__wololoopMain(clean);
    await new Promise((resolve) => setTimeout(resolve, 0));
    post({ type: "done", payload: failure ? { ok: false, where: "code", error: failure } : { ok: true } });
    return;
  }

  try {
    load(msg.js.tests, "tests.js");
  } catch (err) {
    post({ type: "done", payload: { ok: false, where: "tests", error: clean(err) } });
    return;
  }
  const rows = await self.__wololoopRun(msg.stages || null, clean);
  post({ type: "done", payload: { ok: true, rows } });
};
