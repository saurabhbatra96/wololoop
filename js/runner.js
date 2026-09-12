/* Main-thread side of the worker protocol: request/response with a watchdog. */

class PyRunner {
  constructor({ onStdout, onStatus }) {
    this.onStdout = onStdout || (() => {});
    this.onStatus = onStatus || (() => {});
    this.worker = null;
    this.ready = null;
    this.pending = new Map();
    this.nextId = 1;
  }

  spawn() {
    this.worker = new Worker("js/pyworker.js");
    this.worker.onmessage = (event) => {
      const msg = event.data || {};
      if (msg.type === "stdout" || msg.type === "stderr") {
        this.onStdout(msg.text, msg.type === "stderr");
        return;
      }
      if (msg.type === "status") {
        this.onStatus(msg.text);
        return;
      }
      if (msg.type === "done") {
        const entry = this.pending.get(msg.id);
        if (!entry) return;
        clearTimeout(entry.watchdog);
        this.pending.delete(msg.id);
        entry.resolve(msg.payload);
      }
    };
    this.worker.onerror = (err) => {
      const message = err.message || "worker failed to start";
      for (const [, entry] of this.pending) {
        clearTimeout(entry.watchdog);
        entry.resolve({ ok: false, where: "runtime", error: message });
      }
      this.pending.clear();
      this.onStatus("runtime error: " + message);
    };
  }

  /* Boot Pyodide. Deliberately not on a watchdog - a cold download is slow. */
  init() {
    if (!this.worker) this.spawn();
    if (!this.ready) {
      this.ready = this.send({ type: "init" }, 0).then((payload) => {
        if (payload.ok) this.onStatus("Python " + payload.python + " · Pyodide " + payload.pyodide + " ready");
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
          this.kill();
          resolve({ ok: false, where: "timeout", error: "Timed out after " + Math.round(timeoutMs / 1000) + "s. Infinite loop?" });
        }, timeoutMs);
      }
      this.pending.set(id, entry);
      this.worker.postMessage(Object.assign({ id }, message));
    });
  }

  async exec(payload, timeoutMs) {
    await this.init();
    return this.send(Object.assign({ type: "exec" }, payload), timeoutMs);
  }

  /* Terminate and respawn. The Python session is lost - that is the trade. */
  kill() {
    if (this.worker) this.worker.terminate();
    for (const [, entry] of this.pending) {
      clearTimeout(entry.watchdog);
      entry.resolve({ ok: false, where: "stopped", error: "Stopped." });
    }
    this.pending.clear();
    this.ready = null;
    this.spawn();
    this.onStatus("restarting runtime");
    this.init();
  }
}
