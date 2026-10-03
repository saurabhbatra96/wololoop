// Tests for 16c - TS Warm-up 6: Sharing Work Between Callers.

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

test(1, "concurrent loads share one fetch", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const a = loader.load("n1"), b = loader.load("n1"), c = loader.load("n2");
  assertEqual(f.calls, ["n1", "n2"]);
  f.pending[0].d.resolve("note one");
  f.pending[1].d.resolve("note two");
  assertEqual(await Promise.all([a, b, c]), ["note one", "note one", "note two"]);
});

test(1, "successes are cached", async () => {
  const f = countingFetch();
  const loader = createLoader(f.fetch);
  const first = loader.load("n1");
  f.pending[0].d.resolve("v1");
  await first;
  assertEqual(await loader.load("n1"), "v1");
  assertEqual(f.calls.length, 1);
});

test(1, "the cache expires after ttlMs", async () => {
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

test(1, "failures reject every waiter and aren't cached", async () => {
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

test(1, "invalidate forgets the cached value", async () => {
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

test(1, "a fetch in flight during invalidate doesn't refill the cache", async () => {
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
