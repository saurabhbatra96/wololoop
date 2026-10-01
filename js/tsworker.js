/* Web Worker: the TypeScript compiler. Long-lived - loading and parsing
 * typescript.js is the slow part, so it happens once. It only type-checks and
 * transpiles; your code never runs here (see js/tsexec.js). */

importScripts("../runtime/tscompile.js");

const CDN = "https://cdn.jsdelivr.net/npm/typescript@" + TsCompile.TS_VERSION + "/lib/";

let compiler = null;
let bootPromise = null;
let libs = null;
let reactCompiler = null;
let reactPromise = null;

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
      const [loaded, ambient] = await Promise.all([
        TsCompile.loadLibs((name) => fetchText(CDN + name)),
        fetchText("../runtime/ambient.d.ts"),
      ]);
      libs = loaded;
      compiler = TsCompile.createCompiler(self.ts, libs, ambient);
      return compiler;
    })();
  }
  return bootPromise;
}

/* React challenges also need the DOM lib (~1 MB) and @types/react, so those load on first use. */
function bootReact() {
  if (!reactPromise) {
    reactPromise = (async () => {
      await boot();
      post({ type: "status", text: "Fetching React types" });
      const [, types] = await Promise.all([
        TsCompile.loadLibs((name) => fetchText(CDN + name), TsCompile.REACT_LIBS, libs),
        TsCompile.loadReactTypes((pkg, version, name) =>
          fetchText("https://cdn.jsdelivr.net/npm/" + pkg + "@" + version + "/" + name)),
      ]);
      reactCompiler = TsCompile.createCompiler(self.ts, libs, "", { types });
      return reactCompiler;
    })();
    reactPromise.catch(() => { reactPromise = null; });
  }
  return reactPromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const id = msg.id;
  try {
    let c = await boot();
    if (msg.react) c = await bootReact();
    if (msg.type === "init") {
      post({ type: "done", id, payload: { ok: true, version: self.ts.version, react: Boolean(msg.react) } });
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
