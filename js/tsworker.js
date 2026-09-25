/* Web Worker: the TypeScript compiler. Long-lived - loading and parsing
 * typescript.js is the slow part, so it happens once. It only type-checks and
 * transpiles; your code never runs here (see js/tsexec.js). */

importScripts("../runtime/tscompile.js");

const CDN = "https://cdn.jsdelivr.net/npm/typescript@" + TsCompile.TS_VERSION + "/lib/";

let compiler = null;
let bootPromise = null;

const post = (msg) => self.postMessage(msg);

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + " -> HTTP " + response.status);
  return response.text();
}

function boot() {
  if (compiler) return Promise.resolve(compiler);
  if (!bootPromise) {
    bootPromise = (async () => {
      post({ type: "status", text: "Fetching TypeScript compiler (~9 MB, cached after the first time)" });
      importScripts(CDN + "typescript.js");
      const [libs, ambient] = await Promise.all([
        TsCompile.loadLibs((name) => fetchText(CDN + name)),
        fetchText("../runtime/ambient.d.ts"),
      ]);
      compiler = TsCompile.createCompiler(self.ts, libs, ambient);
      return compiler;
    })();
  }
  return bootPromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const id = msg.id;
  try {
    const c = await boot();
    if (msg.type === "init") {
      post({ type: "done", id, payload: { ok: true, version: self.ts.version } });
      return;
    }
    if (msg.type === "compile") {
      const compiled = c.compile({ code: msg.code, harness: msg.harness, tests: msg.tests });
      post({ type: "done", id, payload: { ok: true, compiled } });
      return;
    }
    post({ type: "done", id, payload: { ok: false, where: "runtime", error: "unknown message " + msg.type } });
  } catch (err) {
    post({ type: "done", id, payload: { ok: false, where: "runtime", error: String((err && err.message) || err) } });
  }
};
