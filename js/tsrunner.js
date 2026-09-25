/* Main-thread side of the TypeScript pad. Same interface as PyRunner
 * (init / exec / kill), so app.js doesn't care which language it's driving.
 *
 * Two workers: a long-lived compiler (js/tsworker.js) and a throwaway
 * executor per run (js/tsexec.js). Type errors come back from the compiler
 * and are folded into the test results by TsCompile.mergeTypeResults. */

const COMPILE_TIMEOUT_MS = 30000;

class TsRunner {
  constructor({ onStdout, onStatus }) {
    this.onStdout = onStdout || (() => {});
    this.onStatus = onStatus || (() => {});
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

  /* Boot the compiler. Not on a watchdog - a cold download is slow. */
  init() {
    if (!this.compiler) this.spawnCompiler();
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
    const booted = await this.init();
    if (!booted.ok) return booted;

    const compiledReply = await this.send({ type: "compile", code: payload.code, harness: payload.harness,
                                            tests: payload.mode === "test" ? payload.tests : "" }, COMPILE_TIMEOUT_MS);
    if (!compiledReply.ok) return compiledReply;
    const compiled = compiledReply.compiled;

    const own = compiled.diagnostics.filter((d) => d.file === "your_code.ts");
    if (own.length) {
      this.onStdout(own.length + " type error" + (own.length === 1 ? "" : "s") + " (running anyway):\n" +
                    own.map(TsCompile.formatDiagnostic).join("\n") + "\n\n", true);
    }

    const reply = await this.runCompiled(compiled, payload, timeoutMs);
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

  /* Stop the running program. The compiler survives - nothing to lose there. */
  kill() {
    if (this.exec_) this.exec_.finish({ ok: false, where: "stopped", error: "Stopped." });
  }
}
