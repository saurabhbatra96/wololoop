// 16b - TS Warm-up 5: When Async Things Fail: reference solution.


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle<T>(promises: readonly Promise<T>[]): Promise<{ values: T[]; errors: unknown[] }> {
  const results = await Promise.allSettled(promises);
  const values: T[] = [];
  const errors: unknown[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") values.push(r.value);
    else errors.push(r.reason);
  }
  return { values, errors };
}

async function firstSuccessful<T>(attempts: readonly (() => Promise<T>)[]): Promise<T> {
  const errors: unknown[] = [];
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (err) {
      errors.push(err);
    }
  }
  throw new AggregateError(errors, "every attempt failed");
}

async function retry<T>(fn: () => Promise<T>, options: {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<T> {
  const wait = options.sleep ?? sleep;
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < options.attempts) await wait(options.delayMs);
    }
  }
  throw lastError;
}
