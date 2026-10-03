// Tests for 16b - TS Warm-up 5: When Async Things Fail.

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

test(1, "settle waits for everything and splits results", async () => {
  const slow = manual<number>();
  const result = settle([Promise.resolve(1), Promise.reject(new Error("a")), slow.promise, Promise.reject("b")]);
  slow.resolve(3);
  const { values, errors } = await result;
  assertEqual(values, [1, 3]);
  assertEqual(errors.map((e) => (e instanceof Error ? e.message : e)), ["a", "b"]);
});

test(1, "firstSuccessful stops at the first success", async () => {
  const called: string[] = [];
  const attempt = (name: string, ok: boolean) => async () => {
    called.push(name);
    if (!ok) throw new Error(name + " failed");
    return name;
  };
  assertEqual(await firstSuccessful([attempt("cache", false), attempt("api", true), attempt("backup", true)]), "api");
  assertEqual(called, ["cache", "api"]);
});

test(1, "firstSuccessful runs them in order, not all at once", async () => {
  const first = manual<string>();
  let secondStarted = false;
  const result = firstSuccessful([() => first.promise, async () => { secondStarted = true; return "b"; }]);
  await ticks();
  assertEqual(secondStarted, false);
  first.reject(new Error("nope"));
  assertEqual(await result, "b");
});

test(1, "firstSuccessful: all failed is an AggregateError", async () => {
  const err = await assertRejects(() => firstSuccessful([
    async () => { throw new Error("one"); }, async () => { throw new Error("two"); },
  ]), AggregateError);
  assertEqual((err as AggregateError).errors.map((e: Error) => e.message), ["one", "two"]);
});

test(1, "retry sleeps between attempts only", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  const value = await retry(async () => {
    calls++;
    if (calls < 3) throw new Error("flaky " + calls);
    return "ok";
  }, { attempts: 5, delayMs: 25, sleep: async (ms) => { sleeps.push(ms); } });
  assertEqual([value, calls, sleeps], ["ok", 3, [25, 25]]);
});

test(1, "retry gives up with the last error", async () => {
  const sleeps: number[] = [];
  let calls = 0;
  await assertRejects(() => retry(async () => { calls++; throw new Error("attempt " + calls); },
    { attempts: 3, delayMs: 10, sleep: async (ms) => { sleeps.push(ms); } }), "attempt 3");
  assertEqual([calls, sleeps.length], [3, 2]);
});

