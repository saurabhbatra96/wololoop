// 16 - TypeScript Warm-up: Async - reference solution, all three parts.

// ------------------------------------------------------------------ part 1

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class TimeoutError extends Error {
  constructor(ms: number) {
    super("timed out after " + ms + "ms");
    this.name = "TimeoutError";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function mapSeries<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (const [i, item] of items.entries()) results.push(await fn(item, i));
  return results;
}

function mapParallel<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  return Promise.all(items.map(fn));
}

// ------------------------------------------------------------------ part 2

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

// ------------------------------------------------------------------ part 3

function createLoader<K, V>(
  fetch: (key: K) => Promise<V>,
  options: { ttlMs?: number; now?: () => number } = {},
): { load(key: K): Promise<V>; invalidate(key: K): void } {
  const ttl = options.ttlMs ?? Infinity;
  const now = options.now ?? Date.now;
  const cache = new Map<K, { value: V; at: number }>();
  const inFlight = new Map<K, { promise: Promise<V>; generation: number }>();
  const generations = new Map<K, number>();
  const generationOf = (key: K) => generations.get(key) ?? 0;

  return {
    load(key) {
      const hit = cache.get(key);
      if (hit && now() - hit.at < ttl) return Promise.resolve(hit.value);
      const running = inFlight.get(key);
      if (running && running.generation === generationOf(key)) return running.promise;

      const generation = generationOf(key);
      const promise = fetch(key).then(
        (value) => {
          // An invalidate() while we were fetching bumped the generation: this value may be stale.
          if (generationOf(key) === generation) cache.set(key, { value, at: now() });
          return value;
        },
      ).finally(() => {
        if (inFlight.get(key)?.promise === promise) inFlight.delete(key);
      });
      inFlight.set(key, { promise, generation });
      return promise;
    },
    invalidate(key) {
      cache.delete(key);
      generations.set(key, generationOf(key) + 1);
    },
  };
}

main(async () => {
  const started = Date.now();
  await sleep(100);
  console.log("slept", Date.now() - started, "ms");
});
