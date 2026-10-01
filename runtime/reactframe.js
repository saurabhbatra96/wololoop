/* Runs one compiled React challenge inside a real DOM: a sandboxed iframe in
 * the browser (see js/tsrunner.js), a jsdom window in tools/verify_ts.mjs.
 *
 * Your file and the tests are CommonJS modules here, so `import { useState }
 * from "react"` and `export default function App` work as they would in a real
 * project. require() only knows react, react-dom and ./your_code.
 *
 * Expects React and ReactDOM (the 18.3.1 UMD builds) and TsCompile to be loaded
 * first. Every loop in the compiled code calls __loopGuard(), which throws once
 * the run's time is up - an infinite loop in an iframe can't be killed the way a
 * worker can.
 */

(function (win) {
  const doc = win.document;
  win.ReactDOMClient = win.ReactDOM;

  let deadline = Infinity;
  let spins = 0;
  win.__loopGuard = function () {
    if ((++spins & 1023) === 0 && Date.now() > deadline) {
      throw new Error("A loop kept running past the time limit - is it infinite?");
    }
  };

  // The automatic JSX runtime on top of createElement. jsxs() means "these children are static",
  // so they're spread as arguments - passing them as one array would make React ask for keys.
  const split = (props, key) => {
    const { children, ...rest } = props || {};
    if (key !== undefined) rest.key = key;
    return [rest, children];
  };
  const jsx = (type, props, key) => {
    const [rest, children] = split(props, key);
    return children === undefined ? win.React.createElement(type, rest) : win.React.createElement(type, rest, children);
  };
  const jsxs = (type, props, key) => {
    const [rest, children] = split(props, key);
    return win.React.createElement(type, rest, ...children);
  };
  const jsxRuntime = { jsx, jsxs, jsxDEV: jsx, Fragment: win.React.Fragment };

  function inject(source, name) {
    let failure = null;
    const onError = (event) => { failure = event.error || new Error(event.message); event.preventDefault(); };
    win.addEventListener("error", onError);
    const script = doc.createElement("script");
    script.textContent = source + "\n//# sourceURL=" + name + "\n";
    doc.head.appendChild(script);
    script.remove();
    win.removeEventListener("error", onError);
    if (failure) throw failure;
  }

  function show(value) {
    if (typeof value === "string") return value;
    if (value instanceof win.Error || value instanceof Error) return value.stack || String(value);
    if (value && value.nodeType === 1) return value.outerHTML;
    try {
      return JSON.stringify(value);
    } catch (err) {
      return String(value);
    }
  }

  async function run(payload, post) {
    const maps = payload.maps || {};
    const clean = (err) => win.TsCompile.cleanStack(err, maps);
    const printer = (isError) => (...args) => post({ type: isError ? "stderr" : "stdout", text: args.map(show).join(" ") + "\n" });
    win.console.log = win.console.info = win.console.debug = printer(false);
    win.console.warn = win.console.error = printer(true);
    win.addEventListener("unhandledrejection", (event) => {
      post({ type: "stderr", text: "Unhandled promise rejection: " + clean(event.reason) + "\n" });
    });
    deadline = Date.now() + (payload.timeoutMs || 10000);
    // Tests drive React through act(); a live preview must not, or React warns on every update.
    win.IS_REACT_ACT_ENVIRONMENT = payload.mode === "test";

    const factories = {};
    win.__wololoopFactories = factories;
    const cache = {};
    const evaluate = (key) => {
      if (!cache[key]) {
        const module = { exports: {} };
        cache[key] = module;
        factories[key](require, module.exports, module);
      }
      return cache[key].exports;
    };
    function require(name) {
      if (name === "react") return win.React;
      if (name === "react/jsx-runtime" || name === "react/jsx-dev-runtime") return jsxRuntime;
      if (name === "react-dom" || name === "react-dom/client") return win.ReactDOM;
      if (/^\.\/your_code(\.tsx?)?$/.test(name)) return evaluate("code");
      throw new Error("Cannot import " + JSON.stringify(name) + " here - only react, react-dom and ./your_code are available");
    }
    const define = (key, js, name) =>
      inject("__wololoopFactories." + key + " = function (require, exports, module) {" + js + "\n};", name);

    try {
      inject(payload.js.harness, "harness.js");
    } catch (err) {
      return post({ type: "done", payload: { ok: false, where: "runtime", error: clean(err) } });
    }
    try {
      define("code", payload.js.code, "your_code.js");
      evaluate("code");
    } catch (err) {
      return post({ type: "done", payload: { ok: false, where: "code", error: clean(err) } });
    }

    if (payload.mode === "run") {
      const failure = await win.__wololoopMain(clean);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return post({ type: "done", payload: failure ? { ok: false, where: "code", error: failure } : { ok: true } });
    }

    try {
      define("tests", payload.js.tests, "tests.js");
      evaluate("tests");
    } catch (err) {
      return post({ type: "done", payload: { ok: false, where: "tests", error: clean(err) } });
    }
    const rows = await win.__wololoopRun(payload.stages || null, clean);
    post({ type: "done", payload: { ok: true, rows } });
  }

  win.WololoopFrame = { run };

  if (win.parent && win.parent !== win) {
    win.addEventListener("message", (event) => {
      if (event.source !== win.parent || !event.data || !event.data.js) return;
      run(event.data, (msg) => win.parent.postMessage(msg, "*"));
    });
    win.parent.postMessage({ type: "ready" }, "*");
  }
})(window);
