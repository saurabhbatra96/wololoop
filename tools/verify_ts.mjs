#!/usr/bin/env node
/* Headless check for the TypeScript challenges - the same compile + merge code
 * the browser runs (runtime/tscompile.js), with node:vm standing in for the
 * exec worker.
 *
 *     node tools/verify_ts.mjs challenges/11-notes-api-client ...
 *
 * You normally don't call this directly: tools/verify.py hands it every
 * challenge whose meta.json says "language": "typescript". The compiler is
 * installed on first use into tools/.cache (gitignored), pinned to the same
 * version the browser loads.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const TsCompile = require(path.join(ROOT, "runtime", "tscompile.js"));
const CACHE = path.join(ROOT, "tools", ".cache");

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", RESET = "\x1b[0m";

// Candidate code can leave a rejected promise nobody awaits. The browser prints
// it; here it would kill the process mid-run, so report it and carry on.
process.on("unhandledRejection", (err) => {
  console.error(DIM + "unhandled rejection: " + TsCompile.cleanStack(err, {}).split("\n")[0] + RESET);
});

const MODULES = path.join(CACHE, "node_modules");

/* Everything the verifier needs, pinned to what the browser loads. Installed together, because
 * `npm install --no-save` prunes whatever isn't named in the same command. */
const DEV_DEPS = [
  ["typescript", TsCompile.TS_VERSION],
  ["react", TsCompile.REACT_VERSION],
  ["react-dom", TsCompile.REACT_VERSION],
  ["jsdom", "26.1.0"],
  ...TsCompile.REACT_TYPES.map(([pkg, version]) => [pkg, version]),
];

function ensureDeps() {
  const installedVersion = (pkg) => {
    const file = path.join(MODULES, pkg, "package.json");
    return fs.existsSync(file) && JSON.parse(fs.readFileSync(file, "utf8")).version;
  };
  if (DEV_DEPS.every(([pkg, version]) => installedVersion(pkg) === version)) return;
  console.error(DIM + "installing the pinned compiler, React and jsdom into tools/.cache" + RESET);
  execFileSync("npm", ["install", "--silent", "--no-save", "--prefix", CACHE,
                       ...DEV_DEPS.map(([pkg, version]) => pkg + "@" + version)], { stdio: "inherit" });
}

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");
const requireDep = (pkg) => createRequire(path.join(MODULES, pkg, "package.json"))(pkg);

/* { script, react }: one compiler per challenge kind, created on first use. */
export async function makeCompiler() {
  ensureDeps();
  const ts = requireDep("typescript");
  const libDir = path.join(MODULES, "typescript", "lib");
  const libs = await TsCompile.loadLibs(async (name) => read(libDir, name));
  const compilers = { script: TsCompile.createCompiler(ts, libs, read(ROOT, "runtime", "ambient.d.ts")) };
  compilers.reactCompiler = async () => {
    if (!compilers.react) {
      await TsCompile.loadLibs(async (name) => read(libDir, name), TsCompile.REACT_LIBS, libs);
      const types = await TsCompile.loadReactTypes(async (pkg, version, name) => read(MODULES, pkg, name));
      compilers.react = TsCompile.createCompiler(ts, libs, "", { types });
    }
    return compilers.react;
  };
  return compilers;
}

/* Compile, run, fold type errors in. Mirrors TsRunner.exec: a vm context for plain TypeScript,
 * a jsdom window running runtime/reactframe.js for React. */
export async function runCase(compilers, { code, tests, stages = null, mode = "test", react = false }) {
  let harness = read(ROOT, "runtime", "harness.ts");
  if (react) harness += "\n" + read(ROOT, "runtime", "harness-react.ts");
  const compiler = react ? await compilers.reactCompiler() : compilers.script;
  const compiled = compiler.compile({ code, harness, tests: mode === "test" ? tests : "" });
  if (react) return runInJsdom(compiled, { stages, mode });
  const stdout = [];
  const sink = (...args) => stdout.push(args.map(String).join(" "));
  const context = vm.createContext({
    console: { log: sink, info: sink, warn: sink, error: sink, debug: sink, table: sink },
    setTimeout, clearTimeout, queueMicrotask, structuredClone, atob, btoa, TextEncoder, TextDecoder, URLSearchParams,
    crypto: globalThis.crypto,
  });
  const clean = (err) => TsCompile.cleanStack(err, compiled.maps);

  const order = [["harness", "harness.js"], ["code", "your_code.js"]];
  if (mode === "test") order.push(["tests", "tests.js"]);
  for (const [key, filename] of order) {
    try {
      vm.runInContext(compiled.js[key], context, { filename });
    } catch (err) {
      return { ok: false, where: key === "code" ? "code" : "tests", error: clean(err), compiled, stdout };
    }
  }
  if (mode !== "test") return { ok: true, compiled, stdout };

  const rows = await vm.runInContext("__wololoopRun", context)(stages, clean);
  const result = TsCompile.mergeTypeResults({ tests: rows }, compiled, stages);
  return { ok: true, result, compiled, stdout };
}

let reactScripts = null;

async function runInJsdom(compiled, { stages, mode }) {
  const { JSDOM, VirtualConsole } = requireDep("jsdom");
  reactScripts ??= [
    read(MODULES, "react", "umd", "react.development.js"),
    read(MODULES, "react-dom", "umd", "react-dom.development.js"),
    read(ROOT, "runtime", "tscompile.js"),
    read(ROOT, "runtime", "reactframe.js"),
  ];
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>',
                        // A silent console: React's dev build re-dispatches render errors as window
                        // "error" events, and the harness already reports them per test.
                        { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: new VirtualConsole() });
  dom.window.MessageChannel = MessageChannel; // React's act() queues work through it; jsdom has none
  reactScripts.forEach((source) => dom.window.eval(source));
  const stdout = [];
  const reply = await new Promise((resolve) => {
    dom.window.WololoopFrame.run({ js: compiled.js, maps: compiled.maps, mode, stages, timeoutMs: 20000 }, (msg) => {
      if (msg.type === "done") resolve(msg.payload);
      else stdout.push(msg.text);
    });
  });
  dom.window.close();
  if (!reply.ok || mode !== "test") return { ...reply, compiled, stdout };
  return { ok: true, result: TsCompile.mergeTypeResults({ tests: reply.rows }, compiled, stages), compiled, stdout };
}

async function verify(compilers, dir) {
  const name = path.basename(dir);
  const failures = [];
  const react = fs.existsSync(path.join(dir, "tests.tsx"));
  const ext = react ? ".tsx" : ".ts";
  const tests = read(dir, "tests" + ext);

  const solution = await runCase(compilers, { code: read(dir, "solution" + ext), tests, react });
  const hDiag = solution.compiled.diagnostics.filter((d) => d.file === "harness.ts");
  hDiag.forEach((d) => failures.push("harness: " + TsCompile.formatDiagnostic(d)));
  if (!solution.ok) {
    failures.push("solution failed to load: " + solution.error);
  } else {
    for (const t of solution.result.tests) {
      if (t.status !== "pass") {
        failures.push("solution / part " + t.stage + " / " + t.name + " [" + t.status + "]\n" +
          t.message.split("\n").slice(0, 8).map((l) => "      " + l).join("\n"));
      }
    }
  }

  const starter = await runCase(compilers, { code: read(dir, "starter" + ext), tests, stages: [1], react });
  if (starter.ok) {
    const one = starter.result.tests.filter((t) => t.stage === 1);
    if (one.length && one.every((t) => t.status === "pass")) {
      failures.push("starter.ts already passes part 1 - the stage has no teeth");
    }
    const starterCodeErrors = starter.compiled.diagnostics.filter((d) => /^your_code\./.test(d.file || ""));
    starterCodeErrors.forEach((d) => failures.push("starter.ts should type-check: " + TsCompile.formatDiagnostic(d)));
    // Helpers outside test() blocks must compile against the bare starter, or
    // Part 1 can never go green: those errors fail every stage's type-check row.
    starter.compiled.diagnostics
      .filter((d) => /^tests\./.test(d.file || "") && !starter.compiled.testSpans.some((sp) => d.line >= sp.start && d.line <= sp.end))
      .forEach((d) => failures.push("tests.ts outside any test() fails against the starter: " + TsCompile.formatDiagnostic(d)));
  }

  if (failures.length) {
    console.log(RED + name.padEnd(34) + " FAIL" + RESET);
    failures.forEach((f) => console.log("    " + f));
    return false;
  }
  const summary = solution.result.stages.map((s) => "p" + s.stage + ":" + s.total).join(" ");
  console.log(GREEN + name.padEnd(34) + " ok" + RESET + "  " + DIM + solution.result.total + " tests (" +
              summary + ", tsc strict" + (react ? ", React" : "") + ")" + RESET);
  return true;
}

async function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.log("usage: node tools/verify_ts.mjs <challenge dir>...");
    return 2;
  }
  const compilers = await makeCompiler();
  let ok = true;
  for (const dir of dirs) ok = (await verify(compilers, path.resolve(dir))) && ok;
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
