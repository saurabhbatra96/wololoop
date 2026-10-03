// Tests for 16a - TS Warm-up 4: Promises in Series and in Parallel.

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

