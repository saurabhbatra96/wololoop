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

function loadTypeScript() {
  const pkg = path.join(CACHE, "node_modules", "typescript", "package.json");
  const installed = fs.existsSync(pkg) && JSON.parse(fs.readFileSync(pkg, "utf8")).version;
  if (installed !== TsCompile.TS_VERSION) {
    console.error(DIM + "installing typescript@" + TsCompile.TS_VERSION + " into tools/.cache" + RESET);
    execFileSync("npm", ["install", "--silent", "--no-save", "--prefix", CACHE, "typescript@" + TsCompile.TS_VERSION],
                 { stdio: "inherit" });
  }
  return createRequire(pkg)("typescript");
}

const read = (...parts) => fs.readFileSync(path.join(...parts), "utf8");

export async function makeCompiler() {
  const ts = loadTypeScript();
  const libDir = path.join(CACHE, "node_modules", "typescript", "lib");
  const libs = await TsCompile.loadLibs(async (name) => read(libDir, name));
  return TsCompile.createCompiler(ts, libs, read(ROOT, "runtime", "ambient.d.ts"));
}

/* Compile, run in a fresh vm context, fold type errors in. Mirrors TsRunner.exec. */
export async function runCase(compiler, { code, tests, stages = null, mode = "test" }) {
  const harness = read(ROOT, "runtime", "harness.ts");
  const compiled = compiler.compile({ code, harness, tests: mode === "test" ? tests : "" });
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

async function verify(compiler, dir) {
  const name = path.basename(dir);
  const failures = [];
  const tests = read(dir, "tests.ts");

  const solution = await runCase(compiler, { code: read(dir, "solution.ts"), tests });
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

  const starter = await runCase(compiler, { code: read(dir, "starter.ts"), tests, stages: [1] });
  if (starter.ok) {
    const one = starter.result.tests.filter((t) => t.stage === 1);
    if (one.length && one.every((t) => t.status === "pass")) {
      failures.push("starter.ts already passes part 1 - the stage has no teeth");
    }
    const starterCodeErrors = starter.compiled.diagnostics.filter((d) => d.file === "your_code.ts");
    starterCodeErrors.forEach((d) => failures.push("starter.ts should type-check: " + TsCompile.formatDiagnostic(d)));
    // Helpers outside test() blocks must compile against the bare starter, or
    // Part 1 can never go green: those errors fail every stage's type-check row.
    starter.compiled.diagnostics
      .filter((d) => d.file === "tests.ts" && !starter.compiled.testSpans.some((sp) => d.line >= sp.start && d.line <= sp.end))
      .forEach((d) => failures.push("tests.ts outside any test() fails against the starter: " + TsCompile.formatDiagnostic(d)));
  }

  if (failures.length) {
    console.log(RED + name.padEnd(34) + " FAIL" + RESET);
    failures.forEach((f) => console.log("    " + f));
    return false;
  }
  const summary = solution.result.stages.map((s) => "p" + s.stage + ":" + s.total).join(" ");
  console.log(GREEN + name.padEnd(34) + " ok" + RESET + "  " + DIM + solution.result.total + " tests (" +
              summary + ", tsc strict)" + RESET);
  return true;
}

async function main() {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.log("usage: node tools/verify_ts.mjs <challenge dir>...");
    return 2;
  }
  const compiler = await makeCompiler();
  let ok = true;
  for (const dir of dirs) ok = (await verify(compiler, path.resolve(dir))) && ok;
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
