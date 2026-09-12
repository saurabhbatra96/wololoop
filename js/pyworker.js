/* Web Worker: boots Pyodide and executes the user's code.
 *
 * Everything runs here so a runaway loop never freezes the page - the main
 * thread just terminates this worker and spawns a fresh one. That is also why
 * there is no interrupt buffer: SharedArrayBuffer needs COOP/COEP response
 * headers, and GitHub Pages cannot set headers.
 */

const PYODIDE_VERSION = "0.28.3";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";

let pyodide = null;
let bootPromise = null;

const post = (msg) => self.postMessage(msg);

const DRIVER = `
def _pcp_run(user_src, harness_src, tests_src, stages, mode):
    import json, sys, traceback

    internal = ("<harness>", "<driver>")

    def clean():
        etype, exc, tb = sys.exc_info()
        frames = [f for f in traceback.extract_tb(tb) if f.filename not in internal]
        body = "".join(traceback.format_list(frames))
        body += "".join(traceback.format_exception_only(etype, exc))
        return body.strip()

    ns = {"__name__": "__main__" if mode == "run" else "__test__"}

    if harness_src:
        exec(compile(harness_src, "<harness>", "exec"), ns)

    try:
        exec(compile(user_src, "your_code.py", "exec"), ns)
    except BaseException:
        return json.dumps({"ok": False, "where": "code", "error": clean()})

    if mode == "run":
        return json.dumps({"ok": True})

    try:
        exec(compile(tests_src, "tests.py", "exec"), ns)
    except BaseException:
        return json.dumps({"ok": False, "where": "tests", "error": clean()})

    if "_harness_run" not in ns:
        return json.dumps({"ok": False, "where": "tests", "error": "harness did not load"})

    wanted = set(stages) if stages else None
    try:
        return json.dumps({"ok": True, "result": ns["_harness_run"](wanted)})
    except BaseException:
        return json.dumps({"ok": False, "where": "tests", "error": clean()})
`;

async function boot() {
  if (pyodide) return pyodide;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    post({ type: "status", text: "Fetching Python runtime (~11 MB, cached after the first time)" });
    importScripts(INDEX_URL + "pyodide.js");
    const py = await loadPyodide({ indexURL: INDEX_URL });
    py.setStdout({ batched: (text) => post({ type: "stdout", text: text + "\n" }) });
    py.setStderr({ batched: (text) => post({ type: "stderr", text: text + "\n" }) });
    py.runPython(DRIVER, { filename: "<driver>" });
    pyodide = py;
    return py;
  })();

  return bootPromise;
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  const id = msg.id;

  try {
    const py = await boot();

    if (msg.type === "init") {
      const pyver = py.runPython("import sys; '.'.join(map(str, sys.version_info[:3]))");
      post({ type: "done", id, payload: { ok: true, python: pyver, pyodide: PYODIDE_VERSION } });
      return;
    }

    if (msg.type === "exec") {
      const raw = py.globals.get("_pcp_run")(
        msg.code || "",
        msg.harness || "",
        msg.tests || "",
        msg.stages || null,
        msg.mode || "run"
      );
      post({ type: "done", id, payload: JSON.parse(raw) });
      return;
    }

    post({ type: "done", id, payload: { ok: false, error: "unknown message " + msg.type } });
  } catch (err) {
    post({ type: "done", id, payload: { ok: false, where: "runtime", error: String(err && err.message || err) } });
  }
};
