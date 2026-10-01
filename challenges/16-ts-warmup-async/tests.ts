// Tests for 16 - TypeScript Warm-up: Async.

/** A promise you settle by hand. Typed structurally, so it compiles before Part 1 exists. */
function manual<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function ticks(n = 10) {
  for (let i = 0; i < n; i++) await null;
}

// ------------------------------------------------------------------ part 1

test(1, "sleep waits about that long", async () => {
  const started = Date.now();
  await sleep(40);
  const took = Date.now() - started;
  assert(took >= 35 && took < 400, "slept " + took + "ms for sleep(40)");
});

test(1, "withTimeout: the promise wins", async () => {
  assertEqual(await withTimeout(Promise.resolve("note"), 50), "note");
  await assertRejects(() => withTimeout(Promise.reject(new Error("404")), 50), "404");
});

test(1, "withTimeout: the clock wins", async () => {
  const never = new Promise<string>(() => {});
  const err = await assertRejects(() => withTimeout(never, 20));
  assert(err instanceof Error && err.name === "TimeoutError", "expected a TimeoutError, got " + String(err));
});

test(1, "mapSeries runs one at a time, in order", async () => {
  let running = 0, most = 0;
  const started: number[] = [];
  const out = await mapSeries([3, 1, 2], async (n, i) => {
    started.push(i);
    running++; most = Math.max(most, running);
    await ticks(n * 3);
    running--;
    return n * 10;
  });
  assertEqual([out, started, most], [[30, 10, 20], [0, 1, 2], 1]);
});

test(1, "mapParallel starts everything, keeps input order", async () => {
  const gates = [manual<string>(), manual<string>(), manual<string>()];
  let calls = 0;
  const all = mapParallel(["a", "b", "c"], (_, i) => { calls++; return gates[i].promise; });
  all.catch(() => {}); // awaited below; this just keeps an early rejection from being "unhandled"
  await ticks();
  assertEqual(calls, 3, "all three should have started before any finished");
  gates[2].resolve("C"); gates[0].resolve("A"); gates[1].resolve("B");
  assertEqual(await all, ["A", "B", "C"]);
});

test(1, "both handle an empty list", async () => {
  assertEqual([await mapSeries([], async (x) => x), await mapParallel([], async (x) => x)], [[], []]);
});

// ------------------------------------------------------------------ part 2

test(2, "settle waits for everything and splits results", async () => {
  const slow = manual<number>();
  const result = settle([Promise.resolve(1), Promise.reject(new Error("a")), slow.promise, Promise.reject("b")]);
  slow.resolve(3);
  const { values, errors } = await result;
  assertEqual(values, [1, 3]);
  assertEqual(errors.map((e) => (e instanceof Error ? e.message : e)), ["a", "b"]);
});

test(2, "firstSuccessful stops at the first success", async () => {
  const called: string[] = [];
  const attempt = (name: string, ok: boolean) => async () => {
    called.push(name);
    if (!ok) throw new Error(name + " failed");
    return name;
  };
  assertEqual(await firstSuccessful([attempt("cache", false), attempt("api", true), attempt("backup", true)]), "api");
  assertEqual(called, ["cache", "api"]);
});

test(2, "firstSuccessful runs them in order, not all at once", async () => {
  const first = manual<string>();
  let secondStarted = false;
  const result = firstSuccessful([() => first.promise, async () => { secondStarted = true; return "b"; }]);
  await ticks();
  assertEqual(secondStarted, false);
  first.reject(new Error("nope"));
  assertEqual(await result, "b");
});

test(2, "firstSuccessful: all failed is an AggregateError", async () => {
  const err = await assertRejects(() => firstSuccessful([
    async () => { throw new Error("one"); }, async () => { throw new Error("two"); },
  ]), AggregateError);
  assertEqual((err as AggregateError).errors.map((e: Error) => e.message), ["one", "two"]);
});

test(2, "retry sleeps between attempts only", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const value = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error("flaky " + calls);
    return "ok";
  }, { attempts: 5, delayMs: 25, sleep: async (ms) => { sleeps.push(ms); } });
  assertEqual([value, calls, sleeps], ["ok", 3, [25, 25]]);
});

test(2, "retry gives up with the last error", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  await assertRejects(() => retry(async () => { calls++; throw new Error("attempt " + calls); },
    { attempts: 3, delayMs: 10, sleep: async (ms) => { sleeps.push(ms); } }), "attempt 3");
  assertEqual([calls, sleeps.length], [3, 2]);
});

// ------------------------------------------------------------------ part 3

/** @stage 3 */
function countingFetch() {
  const calls: string[] = [];
  const pending: { key: string; d: ReturnType<typeof manual<string>> }[] = [];
  const fetch = (key: string) => {
    calls.push(key);
    const d = manual<string>();
    pending.push({ key, d });
    return d.promise;
  };
  return { calls, pending, fetch };
}

test(3, "concurrent loads share one fetch", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const a = loader.load("n1"), b = loader.load("n1"), c = loader.load("n2");
  assertEqual(f.calls, ["n1", "n2"]);
  f.pending[0].d.resolve("note one");
  f.pending[1].d.resolve("note two");
  assertEqual(await Promise.all([a, b, c]), ["note one", "note one", "note two"]);
});

test(3, "successes are cached", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const first = loader.load("n1");
  f.pending[0].d.resolve("v1");
  await first;
  assertEqual(await loader.load("n1"), "v1");
  assertEqual(f.calls.length, 1);
});

test(3, "the cache expires after ttlMs", async () => {
  const f = countingFetch();
  let clock = 1000;
  const loader = createLoader(f.fetch, { ttlMs: 500, now: () => clock });
  const first = loader.load("n1");
  f.pending[0].d.resolve("v1");
  await first;
  clock = 1499;
  assertEqual(await loader.load("n1"), "v1");
  clock = 1500;
  const refreshed = loader.load("n1");
  assertEqual(f.calls.length, 2);
  f.pending[1].d.resolve("v2");
  assertEqual(await refreshed, "v2");
});

test(3, "failures reject every waiter and aren't cached", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const a = loader.load("n1"), b = loader.load("n1");
  f.pending[0].d.reject(new Error("503"));
  await assertRejects(() => a, "503");
  await assertRejects(() => b, "503");
  const again = loader.load("n1");
  assertEqual(f.calls.length, 2, "a failure must not stick");
  f.pending[1].d.resolve("v1");
  assertEqual(await again, "v1");
});

test(3, "invalidate forgets the cached value", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const first = loader.load("n1");
  f.pending[0].d.resolve("v1");
  await first;
  loader.invalidate("n1");
  const second = loader.load("n1");
  f.pending[1].d.resolve("v2");
  assertEqual([await second, f.calls.length], ["v2", 2]);
});

test(3, "a fetch in flight during invalidate doesn't refill the cache", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const stale = loader.load("n1");
  loader.invalidate("n1");
  const fresh = loader.load("n1");
  assertEqual(f.calls.length, 2, "after invalidate, a new load must not join the old fetch");
  f.pending[0].d.resolve("stale");
  assertEqual(await stale, "stale", "the original caller still gets its answer");
  f.pending[1].d.resolve("fresh");
  assertEqual(await fresh, "fresh");
  assertEqual(await loader.load("n1"), "fresh");
  assertEqual(f.calls.length, 2);
});
