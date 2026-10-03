// 16b - TS Warm-up 5: When Async Things Fail
//
// Fill in the three bodies. sleep() is given.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Waits for EVERY promise (even after one fails) and splits the results. Both lists keep input order. */
async function settle<T>(promises: readonly Promise<T>[]): Promise<{ values: T[]; errors: unknown[] }> {
  throw new NotImplementedError("settle");
}

/**
 * Tries each function in order, one at a time; resolves with the first success and never calls the rest.
 * If all fail: rejects with an AggregateError holding every error, in order.
 */
async function firstSuccessful<T>(attempts: readonly (() => Promise<T>)[]): Promise<T> {
  throw new NotImplementedError("firstSuccessful");
}

/**
 * Calls fn up to `attempts` times, sleeping `delayMs` between tries (not before the first, not after the last).
 * Rejects with the LAST error. `sleep` is injectable so tests don't wait.
 */
async function retry<T>(fn: () => Promise<T>, options: {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<T> {
  throw new NotImplementedError("retry");
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  let calls = 0;
  const flaky = async () => {
    calls++;
    if (calls < 3) throw new Error("flaky #" + calls);
    return "worked on try " + calls;
  };
  console.log(await retry(flaky, { attempts: 5, delayMs: 100 }));
});
