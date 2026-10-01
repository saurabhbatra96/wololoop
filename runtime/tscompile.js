/* Wololoop TypeScript core: type-check + transpile, shared by the browser
 * (js/tsworker.js) and the headless verifier (tools/verify_ts.mjs), so green
 * in one means green in the other.
 *
 * Three script files - harness.ts, your_code.ts, tests.ts - are checked as one
 * program. None of them are modules, so they share a single global scope, the
 * same "one namespace" contract the Python harness has: tests call your
 * classes by name with no imports.
 *
 * Type errors are part of the result, not a side channel:
 *   - an error inside a test() call in tests.ts fails that test. That is what
 *     makes `// @ts-expect-error` a real test: if your types let a misuse
 *     compile, TS reports the directive as unused and the test goes red.
 *   - any error in your_code.ts adds a failing "your code type-checks" row to
 *     every stage being run. Strict mode is on; `any` gets you through, and an
 *     interviewer will ask about it.
 */

(function (root) {
  const TS_VERSION = "6.0.3";
  const ROOT_LIB = "lib.es2022.d.ts";
  const FILES = { harness: "/harness.ts", code: "/your_code.ts", tests: "/tests.ts", ambient: "/ambient.d.ts" };
  const REACT_FILES = { harness: "/harness.ts", code: "/your_code.tsx", tests: "/tests.tsx" };
  const display = (fileName) => fileName.replace(/^\//, "");

  /* React challenges: modules + JSX + the DOM, typed by the real @types packages. React 18.3.1 is
   * the last release with a UMD build, which is what lets the pad load it without a bundler. */
  const REACT_VERSION = "18.3.1";
  const REACT_LIBS = ["lib.dom.d.ts", "lib.dom.iterable.d.ts"];
  const REACT_TYPES = [
    ["@types/react", "18.3.31", ["package.json", "index.d.ts", "global.d.ts", "jsx-runtime.d.ts", "jsx-dev-runtime.d.ts"]],
    ["@types/react-dom", "18.3.7", ["package.json", "index.d.ts", "client.d.ts"]],
    ["@types/prop-types", "15.7.15", ["package.json", "index.d.ts"]],
    ["csstype", "3.2.3", ["package.json", "index.d.ts"]],
  ];

  /* Fetch the given libs and everything they reference, via readLib(name). */
  async function loadLibs(readLib, roots = [ROOT_LIB], libs = new Map()) {
    let frontier = roots.filter((name) => !libs.has(name));
    while (frontier.length) {
      const texts = await Promise.all(frontier.map((name) => readLib(name)));
      const next = [];
      frontier.forEach((name, i) => {
        libs.set(name, texts[i]);
        const refs = texts[i].matchAll(/\/\/\/\s*<reference\s+lib="([^"]+)"/g);
        for (const [, ref] of refs) {
          const file = "lib." + ref.toLowerCase() + ".d.ts";
          if (!libs.has(file) && !next.includes(file) && !frontier.includes(file)) next.push(file);
        }
      });
      frontier = next;
    }
    return libs;
  }

  /* Fetch the React type packages as a Map of virtual node_modules paths -> text. */
  async function loadReactTypes(readPackageFile) {
    const files = new Map();
    await Promise.all(REACT_TYPES.flatMap(([pkg, version, names]) => names.map(async (name) => {
      files.set("/node_modules/" + pkg + "/" + name, await readPackageFile(pkg, version, name));
    })));
    return files;
  }

  /* Before each loop body, call __loopGuard(). Code runs in an iframe for React challenges, and a
   * busy loop there can freeze the page for good - the guard throws once the run's time is up. */
  function loopGuardTransformer(ts) {
    return (context) => {
      const f = context.factory;
      const guard = () => f.createExpressionStatement(f.createCallExpression(f.createIdentifier("__loopGuard"), undefined, []));
      const wrap = (body) => ts.isBlock(body) ? f.updateBlock(body, [guard(), ...body.statements]) : f.createBlock([guard(), body], true);
      const visit = (node) => {
        node = ts.visitEachChild(node, visit, context);
        if (ts.isForStatement(node)) return f.updateForStatement(node, node.initializer, node.condition, node.incrementor, wrap(node.statement));
        if (ts.isForOfStatement(node)) return f.updateForOfStatement(node, node.awaitModifier, node.initializer, node.expression, wrap(node.statement));
        if (ts.isForInStatement(node)) return f.updateForInStatement(node, node.initializer, node.expression, wrap(node.statement));
        if (ts.isWhileStatement(node)) return f.updateWhileStatement(node, node.expression, wrap(node.statement));
        if (ts.isDoStatement(node)) return f.updateDoStatement(node, wrap(node.statement), node.expression);
        return node;
      };
      return (sourceFile) => ts.visitNode(sourceFile, visit);
    };
  }

  /* `react` is null for plain-TypeScript challenges, or { types: Map } from loadReactTypes. */
  function createCompiler(ts, libs, ambientSource, react = null) {
    const files = react ? REACT_FILES : FILES;
    const options = react ? {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      lib: [ROOT_LIB].concat(REACT_LIBS),
      types: [],
      strict: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noEmitOnError: false,
      sourceMap: true,
      newLine: ts.NewLineKind.LineFeed,
    } : {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      lib: [ROOT_LIB],
      types: [],
      strict: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noEmitOnError: false,
      sourceMap: true,
      inlineSources: false,
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed,
    };

    /* Parsed lib files never change, so parse them once and reuse. */
    const libCache = new Map();
    const libSource = (name) => {
      if (!libCache.has(name)) {
        const text = libs.get(name);
        libCache.set(name, text === undefined ? undefined
          : ts.createSourceFile("/lib/" + name, text, ts.ScriptTarget.ES2022, true));
      }
      return libCache.get(name);
    };

    const typeFiles = react ? react.types : new Map();
    const typeCache = new Map();
    const typeSource = (name) => {
      if (!typeCache.has(name)) typeCache.set(name, ts.createSourceFile(name, typeFiles.get(name), ts.ScriptTarget.ES2022, true));
      return typeCache.get(name);
    };

    function compile({ code, harness, tests }) {
      const sources = { [files.harness]: harness || "", [files.code]: code || "", [files.tests]: tests || "" };
      if (!react) sources[FILES.ambient] = ambientSource || "";
      const outputs = {};

      const host = {
        getSourceFile(fileName, languageVersion) {
          if (fileName.startsWith("/lib/")) return libSource(fileName.slice(5));
          if (typeFiles.has(fileName)) return typeSource(fileName);
          if (fileName in sources) return ts.createSourceFile(fileName, sources[fileName], languageVersion, true);
          return undefined;
        },
        getDefaultLibFileName: () => "/lib/" + ROOT_LIB,
        getDefaultLibLocation: () => "/lib",
        writeFile: (name, text) => { outputs[name] = text; },
        getCurrentDirectory: () => "/",
        getDirectories: () => [],
        directoryExists: (dir) => dir === "/" || Array.from(typeFiles.keys()).some((k) => k.startsWith(dir.replace(/\/?$/, "/"))),
        fileExists: (name) => name in sources || typeFiles.has(name) || (name.startsWith("/lib/") && libs.has(name.slice(5))),
        readFile: (name) => sources[name] ?? typeFiles.get(name) ??
          (name.startsWith("/lib/") ? libs.get(name.slice(5)) : undefined),
        getCanonicalFileName: (name) => name,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => "\n",
      };

      const rootNames = react ? [files.harness] : [FILES.ambient, files.harness];
      if (code !== undefined) rootNames.push(files.code);
      if (tests) rootNames.push(files.tests);

      const program = ts.createProgram({ rootNames, options, host });
      program.emit(undefined, undefined, undefined, false, react ? { before: [loopGuardTransformer(ts)] } : undefined);

      const diagnostics = ts.getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error)
        .map((d) => toDiagnostic(ts, d));

      const js = {};
      const maps = { ext: react ? "tsx" : "ts" };
      for (const [key, file] of Object.entries(files)) {
        if (key === "ambient") continue;
        const base = file.replace(/\.tsx?$/, "");
        js[key] = (outputs[base + ".js"] || "").replace(/\n\/\/# sourceMappingURL=.*\s*$/, "\n");
        maps[key] = outputs[base + ".js.map"] ? decodeLineMap(JSON.parse(outputs[base + ".js.map"]).mappings) : [];
      }

      const testSpans = tests ? findTestSpans(ts, program.getSourceFile(files.tests)) : [];
      return { js, maps, diagnostics, testSpans, react: Boolean(react) };
    }

    return { compile, options };
  }

  function toDiagnostic(ts, d) {
    const message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    if (!d.file) return { file: null, line: 0, col: 0, code: d.code, message };
    const pos = d.file.getLineAndCharacterOfPosition(d.start || 0);
    return { file: display(d.file.fileName), line: pos.line + 1, col: pos.character + 1,
             code: d.code, message };
  }

  function formatDiagnostic(d) {
    return (d.file ? d.file + ":" + d.line + ":" + d.col + " - " : "") + "error TS" + d.code + ": " + d.message;
  }

  /* Every top-level `test(<n>, "<name>", ...)` call in tests.ts, with its line range. Any other
   * top-level statement - a helper, an import - preceded by a `/** @stage n *\/` comment gets a
   * span too: it can use Part n's API without breaking the parts before it, and its type errors
   * count against Part n. */
  function findTestSpans(ts, sourceFile) {
    const spans = [];
    if (!sourceFile) return spans;
    for (const statement of sourceFile.statements) {
      const comments = ts.getLeadingCommentRanges(sourceFile.text, statement.pos) || [];
      const tagged = comments.map((c) => /@stage\s+(\d+)/.exec(sourceFile.text.slice(c.pos, c.end))).find(Boolean);
      if (tagged) {
        const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
        const end = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;
        spans.push({ stage: Number(tagged[1]), name: null, start, end });
        continue;
      }
      if (!ts.isExpressionStatement(statement)) continue;
      const call = statement.expression;
      if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression) || call.expression.text !== "test") continue;
      const [stageArg, nameArg] = call.arguments;
      if (!stageArg || !nameArg || !ts.isNumericLiteral(stageArg) || !ts.isStringLiteralLike(nameArg)) continue;
      const start = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(statement.getEnd()).line + 1;
      spans.push({ stage: Number(stageArg.text), name: nameArg.text, start, end });
    }
    return spans;
  }

  /* ------------------------------------------------ source maps, lines only */

  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  /* Decode a v3 "mappings" string into generated line -> original line (both 1-based). */
  function decodeLineMap(mappings) {
    const lineMap = [];
    let sourceLine = 0;
    mappings.split(";").forEach((group, genLine) => {
      let first = null;
      for (const segment of group.split(",")) {
        if (!segment) continue;
        const fields = [];
        let value = 0, shift = 0;
        for (const ch of segment) {
          let digit = B64.indexOf(ch);
          const more = digit & 32;
          digit &= 31;
          value += digit << shift;
          if (more) { shift += 5; continue; }
          fields.push(value & 1 ? -(value >> 1) : value >> 1);
          value = 0; shift = 0;
        }
        if (fields.length >= 4) {
          sourceLine += fields[2];
          if (first === null) first = sourceLine;
        }
      }
      if (first !== null) lineMap[genLine + 1] = first + 1;
    });
    return lineMap;
  }

  /* Rewrite "<file>.js:<line>:<col>" in a stack to the .ts line it came from. */
  function mapStack(stack, maps) {
    return String(stack || "").replace(/(harness|your_code|tests)\.js:(\d+):(\d+)/g, (whole, name, line) => {
      const key = name === "your_code" ? "code" : name;
      const original = maps[key] && maps[key][Number(line)];
      return name + "." + (maps.ext || "ts") + ":" + (original || line);
    });
  }

  /* Only frames in your code and the tests are worth showing. */
  function cleanStack(error, maps) {
    if (!error || typeof error !== "object") return String(error);
    const head = (error.name || "Error") + ": " + (error.message || "");
    const frames = mapStack(error.stack || "", maps)
      .split("\n")
      .filter((l) => /(your_code|tests)\.tsx?:\d+/.test(l))
      .map((l) => "    " + l.trim().replace(/\(?(?:blob:|file:|https?:)[^()]*?(your_code|tests)\.(tsx?)/, "($1.$2"));
    return [head].concat(frames.slice(0, 6)).join("\n");
  }

  /* ------------------------------------------- fold type errors into results */

  function mergeTypeResults(result, compiled, stages) {
    const wanted = stages ? new Set(stages) : null;
    const codeErrors = compiled.diagnostics.filter((d) => /^your_code\.tsx?$/.test(d.file || ""));
    const orphanTestErrors = [];

    for (const d of compiled.diagnostics.filter((x) => /^tests\.tsx?$/.test(x.file || ""))) {
      const span = compiled.testSpans.find((s) => d.line >= s.start && d.line <= s.end);
      if (!span) { orphanTestErrors.push(d); continue; }
      // a test's error fails that test; a tagged helper's error fails every test in its part
      const rows = result.tests.filter((t) => t.stage === span.stage && (span.name === null || t.name === span.name));
      const note = "type error at " + d.file + ":" + d.line + (span.name === null ? " (a Part " + span.stage + " helper)" : "") +
        " - " + describe(d);
      for (const row of rows) {
        if (row.status !== "pass" && row.status !== "fail") continue;
        row.status = "fail";
        row.message = row.message ? row.message + "\n" + note : note;
      }
    }

    const stageList = Array.from(new Set(result.tests.map((t) => t.stage))).sort((a, b) => a - b);
    const synthetic = [];
    if (codeErrors.length || orphanTestErrors.length) {
      const lines = codeErrors.concat(orphanTestErrors).slice(0, 8).map(formatDiagnostic);
      const more = codeErrors.length + orphanTestErrors.length - lines.length;
      if (more > 0) lines.push("...and " + more + " more (see Output)");
      stageList.filter((s) => !wanted || wanted.has(s)).forEach((stage) => {
        synthetic.push({ name: "your code type-checks (strict)", func: "__typecheck", stage, status: "fail",
                         message: lines.join("\n"), ms: 0 });
      });
    }
    result.tests = result.tests.concat(synthetic).sort((a, b) => a.stage - b.stage);
    return rollup(result.tests);
  }

  function describe(d) {
    if (d.code === 2578) return "unused '@ts-expect-error': your types accept something they should reject";
    return "TS" + d.code + ": " + d.message;
  }

  function rollup(tests) {
    const byStage = new Map();
    for (const t of tests) {
      const bucket = byStage.get(t.stage) || { stage: t.stage, total: 0, passed: 0 };
      bucket.total += 1;
      if (t.status === "pass") bucket.passed += 1;
      byStage.set(t.stage, bucket);
    }
    const stages = Array.from(byStage.values()).sort((a, b) => a.stage - b.stage);
    stages.forEach((s) => { s.all_passed = s.total > 0 && s.passed === s.total; });
    return { tests, stages, passed: tests.filter((t) => t.status === "pass").length, total: tests.length };
  }

  const api = { TS_VERSION, ROOT_LIB, REACT_VERSION, REACT_LIBS, REACT_TYPES, loadLibs, loadReactTypes, createCompiler,
                formatDiagnostic, mapStack, cleanStack,
                mergeTypeResults, rollup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TsCompile = api;
})(typeof self !== "undefined" ? self : this);
