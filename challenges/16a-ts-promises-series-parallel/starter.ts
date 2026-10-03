// 16a - TS Warm-up 4: Promises in Series and in Parallel
//
// Fill in the bodies. TimeoutError is half-written for you.

/** Resolves after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  throw new NotImplementedError("sleep");
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super("timed out after " + ms + "ms");
    this.name = "TimeoutError";
  }
}

/** Settles like `promise`, unless `ms` passes first - then rejects with a TimeoutError. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  throw new NotImplementedError("withTimeout");
}

/** Runs fn on each item ONE AT A TIME (the next starts after the previous finishes). Results in input order. */
async function mapSeries<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  throw new NotImplementedError("mapSeries");
}

/** Starts fn on every item AT ONCE. Results in input order, whatever order they finish in. */
async function mapParallel<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  throw new NotImplementedError("mapParallel");
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const started = Date.now();
  const slowDouble = async (n: number) => { await sleep(100); return n * 2; };
  console.log(await mapSeries([1, 2, 3], slowDouble), "series took", Date.now() - started, "ms");
  const again = Date.now();
  console.log(await mapParallel([1, 2, 3], slowDouble), "parallel took", Date.now() - again, "ms");
});
