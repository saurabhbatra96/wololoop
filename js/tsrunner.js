/* Main-thread side of the TypeScript pad. Same interface as PyRunner
 * (init / exec / kill), so app.js doesn't care which language it's driving.
 *
 * Two workers: a long-lived compiler (js/tsworker.js) and a throwaway
 * executor per run (js/tsexec.js). Type errors come back from the compiler
 * and are folded into the test results by TsCompile.mergeTypeResults. */

const COMPILE_TIMEOUT_MS = 30000;
const FRAME_LOAD_GRACE_MS = 8000; // the iframe fetches React before it can start

/* The page a React run executes in. Sandboxed without allow-same-origin, so your code can't touch
 * Wololoop's own page or storage; React comes from jsDelivr, the runtime files from this site. */
function frameHtml() {
  const here = (path) => new URL(path, document.baseURI).href;
  const react = "https://cdn.jsdelivr.net/npm/react@" + TsCompile.REACT_VERSION + "/umd/react.development.js";
  const reactDom = "https://cdn.jsdelivr.net/npm/react-dom@" + TsCompile.REACT_VERSION + "/umd/react-dom.development.js";
  return '<!doctype html><html><head><meta charset="utf-8">' +
    "<style>body{font:14px/1.45 system-ui,sans-serif;margin:14px;color:#1d1d1f;background:#fff}" +
    "button{font:inherit;cursor:pointer}input,textarea,select{font:inherit}</style>" +
    '<script src="' + react + '"></script><script src="' + reactDom + '"></script>' +
    '<script src="' + here("runtime/tscompile.js") + '"></script>' +
    '<script src="' + here("runtime/reactframe.js") + '"></script>' +
    '</head><body><div id="root"></div></body></html>';
}

class TsRunner {
  constructor({ onStdout, onStatus, previewHost }) {
    this.onStdout = onStdout || (() => {});
    this.onStatus = onStatus || (() => {});
    this.previewHost = previewHost || (() => null);
    this.previewFrame = null;
    this.reactReady = null;
    this.compiler = null;
    this.ready = null;
    this.pending = new Map();
    this.nextId = 1;
    this.exec_ = null;
  }

  spawnCompiler() {
    this.compiler = new Worker("js/tsworker.js");
    this.compiler.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === "status") return this.onStatus(msg.text);
      if (msg.type !== "done") return;
      const entry = this.pending.get(msg.id);
      if (!entry) return;
      clearTimeout(entry.watchdog);
      this.pending.delete(msg.id);
      entry.resolve(msg.payload);
    };
    this.compiler.onerror = (err) => {
      const message = err.message || "compiler worker failed to start";
      for (const [, entry] of this.pending) {
        clearTimeout(entry.watchdog);
        entry.resolve({ ok: false, where: "runtime", error: message });
      }
      this.pending.clear();
      this.onStatus("runtime error: " + message);
    };
  }

  /* Boot the compiler (and, for React challenges, the React types). Not on a watchdog - a cold
   * download is slow. */
  init(react = false) {
    if (!this.compiler) this.spawnCompiler();
    if (react) {
      if (!this.reactReady) {
        this.reactReady = this.send({ type: "init", react: true }, 0).then((payload) => {
          if (payload.ok) this.onStatus("TypeScript " + payload.version + " · React " + TsCompile.REACT_VERSION + " · ready");
          else this.reactReady = null;
          return payload;
        });
      }
      return this.reactReady;
    }
    if (!this.ready) {
      this.ready = this.send({ type: "init" }, 0).then((payload) => {
        if (payload.ok) this.onStatus("TypeScript " + payload.version + " · strict · ready");
        else this.ready = null;
        return payload;
      });
    }
    return this.ready;
  }

  send(message, timeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve) => {
      const entry = { resolve, watchdog: null };
      if (timeoutMs > 0) {
        entry.watchdog = setTimeout(() => {
          this.pending.delete(id);
          resolve({ ok: false, where: "timeout", error: "The compiler took longer than " +
                    Math.round(timeoutMs / 1000) + "s." });
        }, timeoutMs);
      }
      this.pending.set(id, entry);
      this.compiler.postMessage(Object.assign({ id }, message));
    });
  }

  async exec(payload, timeoutMs) {
    const booted = await this.init(payload.react);
    if (!booted.ok) return booted;

    const compiledReply = await this.send({ type: "compile", react: payload.react, code: payload.code,
                                            harness: payload.harness,
                                            tests: payload.mode === "test" ? payload.tests : "" }, COMPILE_TIMEOUT_MS);
    if (!compiledReply.ok) return compiledReply;
    const compiled = compiledReply.compiled;

    const own = compiled.diagnostics.filter((d) => /^your_code\./.test(d.file || ""));
    if (own.length) {
      this.onStdout(own.length + " type error" + (own.length === 1 ? "" : "s") + " (running anyway):\n" +
                    own.map(TsCompile.formatDiagnostic).join("\n") + "\n\n", true);
    }

    const reply = payload.react ? await this.runInFrame(compiled, payload, timeoutMs)
                                : await this.runCompiled(compiled, payload, timeoutMs);
    if (!reply.ok || payload.mode !== "test") return reply;
    return { ok: true, result: TsCompile.mergeTypeResults({ tests: reply.rows }, compiled, payload.stages) };
  }

  runCompiled(compiled, payload, timeoutMs) {
    return new Promise((resolve) => {
      const worker = new Worker("js/tsexec.js");
      const finish = (result) => {
        clearTimeout(watchdog);
        worker.terminate();
        if (this.exec_ && this.exec_.worker === worker) this.exec_ = null;
        resolve(result);
      };
      const watchdog = setTimeout(() => finish({ ok: false, where: "timeout",
        error: "Timed out after " + Math.round(timeoutMs / 1000) + "s. Infinite loop?" }), timeoutMs);
      this.exec_ = { worker, finish };

      worker.onmessage = (event) => {
        const msg = event.data || {};
        if (msg.type === "stdout" || msg.type === "stderr") this.onStdout(msg.text, msg.type === "stderr");
        else if (msg.type === "done") finish(msg.payload);
      };
      worker.onerror = (err) => {
        err.preventDefault();
        finish({ ok: false, where: "runtime", error: err.message || "executor failed" });
      };
      worker.postMessage({ js: compiled.js, maps: compiled.maps, mode: payload.mode, stages: payload.stages });
    });
  }

  /* React: a fresh sandboxed iframe per run. Run mode leaves it in the Preview tab. */
  runInFrame(compiled, payload, timeoutMs) {
    if (this.previewFrame && payload.mode === "run") {
      this.previewFrame.remove();
      this.previewFrame = null;
    }
    return new Promise((resolve) => {
      const frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
      frame.setAttribute("title", "Preview");
      const visible = payload.mode === "run" && this.previewHost();
      if (visible) {
        frame.className = "preview-frame";
        visible.appendChild(frame);
      } else {
        frame.style.cssText = "position:absolute;left:-10000px;top:0;width:900px;height:700px;border:0";
        document.body.appendChild(frame);
      }

      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        window.removeEventListener("message", onMessage);
        if (this.exec_ && this.exec_.frame === frame) this.exec_ = null;
        if (visible && result.ok) this.previewFrame = frame;
        else frame.remove();
        resolve(result);
      };
      const watchdog = setTimeout(() => finish({ ok: false, where: "timeout",
        error: "Timed out after " + Math.round(timeoutMs / 1000) + "s. Infinite loop, or a promise that never settles?" }),
        timeoutMs + FRAME_LOAD_GRACE_MS);
      const onMessage = (event) => {
        if (event.source !== frame.contentWindow) return;
        const msg = event.data || {};
        if (msg.type === "ready") {
          frame.contentWindow.postMessage({ js: compiled.js, maps: compiled.maps, mode: payload.mode,
                                            stages: payload.stages, timeoutMs }, "*");
        } else if (msg.type === "stdout" || msg.type === "stderr") {
          this.onStdout(msg.text, msg.type === "stderr");
        } else if (msg.type === "done") {
          finish(msg.payload);
        }
      };
      window.addEventListener("message", onMessage);
      this.exec_ = { frame, finish };
      frame.srcdoc = frameHtml();
    });
  }

  /* Stop the running program. The compiler survives - nothing to lose there. */
  kill() {
    if (this.exec_) this.exec_.finish({ ok: false, where: "stopped", error: "Stopped." });
  }
}
