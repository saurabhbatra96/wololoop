/* Wololoop - coding interview practice pad. No build step, no framework. */

const STORE_PREFIX = "wololoop:v1:";
const RUN_TIMEOUT_MS = 10000;
const TEST_TIMEOUT_MS = 25000;

const $ = (id) => document.getElementById(id);

const state = {
  manifest: [],
  id: null,
  meta: null,
  parts: [],
  tests: "",
  harness: "",
  starter: "",
  lang: "python",
  unlocked: [1],
  passed: [],
  viewing: 1,
  revealed: false,
  unlockedByHand: [],
  clock: { remaining: 0, running: false, handle: null },
};

/* ------------------------------------------------------------------ editor */

const LANGS = {
  python: { ext: "py", label: "Python", harness: "runtime/harness.py", indent: 4, mode: "python" },
  typescript: { ext: "ts", label: "TypeScript", harness: "runtime/harness.ts", indent: 2,
                mode: { name: "javascript", typescript: true } },
};

const Editor = {
  cm: null,
  textarea: null,

  setLanguage(lang) {
    if (!this.cm) return;
    this.cm.setOption("mode", lang.mode);
    this.cm.setOption("indentUnit", lang.indent);
    this.cm.setOption("tabSize", lang.indent);
  },

  init() {
    this.textarea = $("editor");
    if (!window.CodeMirror) {
      this.textarea.addEventListener("input", scheduleSave);
      return;
    }
    this.cm = CodeMirror.fromTextArea(this.textarea, {
      mode: "python",
      theme: "gruvbox-dark",
      lineNumbers: true,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      matchBrackets: true,
      autoCloseBrackets: true,
      styleActiveLine: true,
      extraKeys: {
        "Ctrl-Enter": runCode,
        "Cmd-Enter": runCode,
        "Shift-Ctrl-Enter": runTests,
        "Shift-Cmd-Enter": runTests,
        "Ctrl-/": (cm) => cm.toggleComment(),
        "Cmd-/": (cm) => cm.toggleComment(),
        Tab: (cm) => cm.execCommand(cm.somethingSelected() ? "indentMore" : "insertSoftTab"),
      },
    });
    this.cm.on("change", scheduleSave);
  },

  get() {
    return this.cm ? this.cm.getValue() : this.textarea.value;
  },

  set(value) {
    if (this.cm) {
      this.cm.setValue(value);
      this.cm.clearHistory();
    } else {
      this.textarea.value = value;
    }
  },

  focus() {
    if (this.cm) this.cm.focus();
    else this.textarea.focus();
  },
};

/* ----------------------------------------------------------------- storage */

function storageKey(id) {
  return STORE_PREFIX + id;
}

function saveSession() {
  if (!state.id) return;
  try {
    localStorage.setItem(
      storageKey(state.id),
      JSON.stringify({
        code: Editor.get(),
        unlocked: state.unlocked,
        passed: state.passed,
        revealed: state.revealed,
        unlockedByHand: state.unlockedByHand,
        remaining: state.clock.remaining,
      })
    );
    localStorage.setItem(STORE_PREFIX + "last", state.id);
  } catch (err) {
    /* private window, blocked storage - practice still works, just forgetful */
  }
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSession, 400);
}

function loadSession(id) {
  try {
    const raw = localStorage.getItem(storageKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

/* ------------------------------------------------------------------ runner */

/* One runner per language, booted the first time a challenge needs it. Each
 * remembers its last status so switching languages repaints the right one. */
const runners = {};
const lastStatus = {};

function runnerFor(lang) {
  if (!runners[lang]) {
    const Runner = lang === "typescript" ? TsRunner : PyRunner;
    runners[lang] = new Runner({
      onStdout: (text, isError) => appendConsole(text, isError ? "err" : ""),
      onStatus: (text) => {
        lastStatus[lang] = text;
        if (state.lang === lang) setRuntime(text, /ready/i.test(text) ? "ready" : "busy");
      },
    });
  }
  return runners[lang];
}

const runner = () => runnerFor(state.lang);

async function harnessFor(lang) {
  if (!harnessFor.cache[lang]) harnessFor.cache[lang] = await fetchText(LANGS[lang].harness);
  return harnessFor.cache[lang];
}
harnessFor.cache = {};

function setRuntime(text, cls) {
  $("runtime-text").textContent = text;
  $("runtime-dot").className = "dot " + (cls || "");
}

function appendConsole(text, cls) {
  const node = document.createElement("span");
  if (cls) node.className = cls;
  node.textContent = text;
  $("console").appendChild(node);
  $("console").scrollTop = $("console").scrollHeight;
}

function clearConsole() {
  $("console").textContent = "";
}

function showOut(which) {
  document.querySelectorAll(".out-tabs button[data-out]").forEach((b) => {
    b.classList.toggle("active", b.dataset.out === which);
  });
  $("console").classList.toggle("hidden", which !== "console");
  $("tests").classList.toggle("hidden", which !== "tests");
}

function setBusy(busy) {
  $("btn-run").disabled = busy;
  $("btn-test").disabled = busy;
  $("btn-stop").disabled = !busy;
}

async function execute(mode) {
  startClockIfIdle();
  clearConsole();
  showOut(mode === "run" ? "console" : "tests");
  setBusy(true);
  setRuntime("running", "busy");

  const started = performance.now();
  const payload = {
    code: Editor.get(),
    // the TS harness also declares main(), so your file needs it even to Run
    harness: mode === "test" || state.lang === "typescript" ? state.harness : "",
    tests: mode === "test" ? state.tests : "",
    stages: mode === "test" ? state.unlocked : null,
    mode,
  };

  const result = await runner().exec(payload, mode === "run" ? RUN_TIMEOUT_MS : TEST_TIMEOUT_MS);
  const elapsed = Math.round(performance.now() - started);

  setBusy(false);
  setRuntime(result.ok ? "ready" : result.where === "timeout" ? "timed out" : "ready",
             result.ok ? "ready" : result.where === "timeout" ? "error" : "ready");

  if (!result.ok) {
    showOut("console");
    appendConsole((result.where === "code" ? "" : "[" + result.where + "] ") + result.error + "\n", "err");
    if (mode === "test") renderTests(null);
    return;
  }

  if (mode === "run") {
    appendConsole("\n[finished in " + elapsed + " ms]\n", "meta");
    return;
  }

  renderTests(result.result);
  applyUnlocks(result.result);
  saveSession();
}

const runCode = () => execute("run");
const runTests = () => execute("test");

/* ------------------------------------------------------------- test output */

function renderTests(result) {
  const host = $("tests");
  host.textContent = "";
  const tally = $("tally");

  if (!result) {
    tally.textContent = "";
    tally.className = "tally";
    updateTests(null);
    host.innerHTML = '<p class="stage-group">Your code or the test file failed to load — see Output.</p>';
    return;
  }

  tally.textContent = result.passed + "/" + result.total;
  tally.className = "tally " + (result.passed === result.total ? "good" : "bad");
  updateTests(result);

  const byStage = new Map();
  result.tests.forEach((t) => {
    if (!byStage.has(t.stage)) byStage.set(t.stage, []);
    byStage.get(t.stage).push(t);
  });

  Array.from(byStage.keys()).sort().forEach((stageNum) => {
    const rollup = result.stages.find((s) => s.stage === stageNum) || { passed: 0, total: 0 };
    const group = document.createElement("div");
    group.className = "stage-group";

    const heading = document.createElement("h4");
    heading.textContent = "Part " + stageNum + " — " + stageName(stageNum) +
      "  (" + rollup.passed + "/" + rollup.total + ")";
    group.appendChild(heading);

    byStage.get(stageNum).forEach((t) => {
      const row = document.createElement("div");
      row.className = "test-row " + t.status;

      const mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = { pass: "✓", fail: "✕", error: "!", todo: "·" }[t.status] || "?";

      const body = document.createElement("div");
      body.className = "name";
      body.textContent = t.name;
      if (t.message) {
        const pre = document.createElement("pre");
        pre.textContent = t.message;
        body.appendChild(pre);
      }

      row.appendChild(mark);
      row.appendChild(body);
      group.appendChild(row);
    });

    host.appendChild(group);
  });
}

/* ------------------------------------------------------------ stage gating */

function updateParts() {
  const parts = $("res-parts");
  if (!parts) return;
  parts.textContent = state.parts.length
    ? state.unlocked.length + "/" + state.parts.length
    : "-/-";
}


function updateTests(result) {
  const tests = $("res-tests");
  if (!tests) return;
  tests.textContent = result ? result.passed + "/" + result.total : "0/0";
}


function stageName(n) {
  const stage = (state.meta.stages || []).find((s) => s.n === n);
  return stage ? stage.name : "Part " + n;
}

function applyUnlocks(result) {
  let unlockedSomething = false;

  result.stages.forEach((s) => {
    if (!s.all_passed) return;
    if (!state.passed.includes(s.stage)) state.passed.push(s.stage);
    const next = s.stage + 1;
    if (next <= state.parts.length && !state.unlocked.includes(next)) {
      state.unlocked.push(next);
      state.unlocked.sort();
      unlockedSomething = true;
      state.viewing = next;
    }
  });

  renderStageTabs();
  renderProblem();

  if (unlockedSomething) {
    toast("Part " + state.viewing + " unlocked — " + stageName(state.viewing));
  } else if (state.passed.length === state.parts.length && state.parts.length) {
    toast("All parts green. Nicely done.");
  }
}

function unlockByHand(n) {
  if (!state.unlocked.includes(n)) {
    state.unlocked.push(n);
    state.unlocked.sort();
    state.unlockedByHand.push(n);
  }
  state.viewing = n;
  renderStageTabs();
  renderProblem();
  saveSession();
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => el.classList.add("hidden"), 3200);
}

/* -------------------------------------------------------------- rendering */

function renderStageTabs() {
  const nav = $("stage-tabs");
  nav.textContent = "";

  state.parts.forEach((_, index) => {
    const n = index + 1;
    const unlocked = state.unlocked.includes(n);
    const button = document.createElement("button");
    button.textContent = (unlocked ? "" : "🔒 ") + "Part " + n;
    button.className =
      (n === state.viewing ? "active " : "") +
      (unlocked ? "" : "locked ") +
      (state.passed.includes(n) ? "passed" : "");
    button.title = unlocked ? stageName(n) : "Locked — pass Part " + (n - 1) + " to open it";
    button.onclick = () => {
      state.viewing = n;
      renderStageTabs();
      renderProblem();
    };
    nav.appendChild(button);
  });

  updateParts();
}

function renderProblem() {
  const host = $("problem-body");
  const n = state.viewing;

  if (state.unlocked.includes(n)) {
    host.innerHTML = renderMarkdown(state.parts[n - 1]);
    host.scrollTop = 0;
    return;
  }

  host.innerHTML =
    '<div class="locked-notice"><p><strong>Part ' + n + " is locked.</strong></p>" +
    "<p>Get Part " + (n - 1) + " green and it opens on its own — that is how the real " +
    "thing goes, and solving for requirements you haven't been given yet is the " +
    "most common way senior candidates lose time.</p></div>";

  const button = document.createElement("button");
  button.className = "ghost";
  button.textContent = "I'm stuck — open it anyway";
  button.onclick = () => unlockByHand(n);
  host.querySelector(".locked-notice").appendChild(button);
}

/* ------------------------------------------------------------------ clock */

function formatClock(seconds) {
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(seconds);
  const mm = String(Math.floor(abs / 60)).padStart(2, "0");
  const ss = String(abs % 60).padStart(2, "0");
  return sign + mm + ":" + ss;
}

function paintClock() {
  $("clock-time").textContent = formatClock(state.clock.remaining);
  const el = $("clock");
  el.classList.toggle("warn", state.clock.remaining <= 300 && state.clock.remaining > 0);
  el.classList.toggle("over", state.clock.remaining <= 0);
  $("clock-toggle").textContent = state.clock.running ? "Pause" : "Start";
}

function tickClock() {
  state.clock.remaining -= 1;
  paintClock();
  if (state.clock.remaining % 10 === 0) saveSession();
}

function startClock() {
  if (state.clock.running) return;
  state.clock.running = true;
  state.clock.handle = setInterval(tickClock, 1000);
  paintClock();
}

function pauseClock() {
  state.clock.running = false;
  clearInterval(state.clock.handle);
  paintClock();
  saveSession();
}

function startClockIfIdle() {
  if (!state.clock.running && state.clock.remaining === state.meta.minutes * 60) startClock();
}

function resetClock() {
  pauseClock();
  state.clock.remaining = state.meta.minutes * 60;
  paintClock();
  saveSession();
}

/* ------------------------------------------------------------------ loading */

async function fetchText(path) {
  const response = await fetch(path, { cache: "no-cache" });
  if (!response.ok) throw new Error(path + " -> HTTP " + response.status);
  return response.text();
}

async function loadChallenge(id) {
  pauseClock();
  const base = "challenges/" + id + "/";
  const meta = JSON.parse(await fetchText(base + "meta.json"));
  const lang = LANGS[meta.language] ? meta.language : "python";
  const ext = LANGS[lang].ext;
  const [partsRaw, starter, tests, harness] = await Promise.all([
    fetchText(base + "parts.md"),
    fetchText(base + "starter." + ext),
    fetchText(base + "tests." + ext),
    harnessFor(lang),
  ]);

  state.id = id;
  state.meta = meta;
  state.lang = lang;
  state.harness = harness;
  Editor.setLanguage(LANGS[lang]);
  setRuntime(lastStatus[lang] || "booting " + LANGS[lang].label + "…",
             /ready/i.test(lastStatus[lang] || "") ? "ready" : "busy");
  runner().init();
  state.parts = partsRaw.split(/\n<!--\s*part\s*-->\n/).map((p) => p.trim()).filter(Boolean);
  state.starter = starter;
  state.tests = tests;

  const saved = loadSession(id);
  state.unlocked = (saved && saved.unlocked) || [1];
  state.passed = (saved && saved.passed) || [];
  state.revealed = Boolean(saved && saved.revealed);
  state.unlockedByHand = (saved && saved.unlockedByHand) || [];
  state.viewing = Math.max.apply(null, state.unlocked);
  state.clock.remaining =
    saved && typeof saved.remaining === "number" ? saved.remaining : state.meta.minutes * 60;

  Editor.set(saved && saved.code ? saved.code : state.starter);

  document.title = state.meta.title + " — Wololoop";
  $("challenge-picker").value = id;
  renderStageTabs();
  renderProblem();
  renderTests(null);
  $("tally").textContent = "";
  clearConsole();
  showOut("console");
  appendConsole(
    state.meta.title + " · " + state.meta.domain + " · " + LANGS[lang].label + " · budget " + state.meta.minutes +
      " min\nRun (Ctrl+Enter) executes your file. Run Tests (Ctrl+Shift+Enter) checks the parts you've unlocked.\n",
    "meta"
  );
  paintClock();
  saveSession();
  Editor.focus();
}

async function loadManifest() {
  const raw = await fetchText("challenges/manifest.json");
  state.manifest = JSON.parse(raw).challenges;

  const picker = $("challenge-picker");
  picker.textContent = "";
  Object.keys(LANGS).forEach((lang) => {
    const entries = state.manifest.filter((c) => (c.language || "python") === lang);
    if (!entries.length) return;
    const group = document.createElement("optgroup");
    group.label = LANGS[lang].label;
    entries.forEach((entry) => {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.id.slice(0, 2) + " · " + entry.title + "  (" + entry.domain + ", " + entry.minutes + "m)";
      group.appendChild(option);
    });
    picker.appendChild(group);
  });

  let start = null;
  try {
    start = localStorage.getItem(STORE_PREFIX + "last");
  } catch (err) {
    start = null;
  }
  if (!state.manifest.some((c) => c.id === start)) start = state.manifest[0].id;
  await loadChallenge(start);
}

/* -------------------------------------------------------------------- wiring */

function wire() {
  $("btn-run").onclick = runCode;
  $("btn-test").onclick = runTests;
  $("btn-stop").onclick = () => {
    runner().kill();
    setBusy(false);
    appendConsole("\n[stopped]\n", "err");
  };
  $("btn-clear").onclick = clearConsole;

  $("btn-reset").onclick = () => {
    if (confirm("Replace the editor contents with the starter file?")) {
      Editor.set(state.starter);
      saveSession();
    }
  };

  $("btn-solution").onclick = async () => {
    const source = await fetchText("challenges/" + state.id + "/solution." + LANGS[state.lang].ext);
    $("solution-body").textContent = source;
    state.revealed = true;
    saveSession();
    $("solution-modal").showModal();
  };
  $("close-solution").onclick = () => $("solution-modal").close();

  $("challenge-picker").onchange = (event) => loadChallenge(event.target.value);

  $("clock-toggle").onclick = () => (state.clock.running ? pauseClock() : startClock());
  $("clock-reset").onclick = resetClock;

  document.querySelectorAll(".out-tabs button[data-out]").forEach((button) => {
    button.onclick = () => showOut(button.dataset.out);
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === "Enter") {
      event.preventDefault();
      event.shiftKey ? runTests() : runCode();
    }
  });

  window.addEventListener("beforeunload", saveSession);

  /* draggable split */
  const gutter = $("gutter");
  let dragging = false;
  gutter.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mousemove", (event) => {
    if (!dragging) return;
    const percent = Math.min(70, Math.max(22, (event.clientX / window.innerWidth) * 100));
    document.querySelector(".problem").style.width = percent + "%";
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    document.body.style.userSelect = "";
  });
}

async function main() {
  Editor.init();
  wire();
  setRuntime("loading…", "busy");

  try {
    await loadManifest();
  } catch (err) {
    setRuntime("failed to load: " + err.message, "error");
    appendConsole(
      "Could not load challenge files: " + err.message +
        "\n\nThis page must be served over http(s), not opened as a file://. Try:\n" +
        "    python3 -m http.server 8080\n",
      "err"
    );
    return;
  }
}

main();
