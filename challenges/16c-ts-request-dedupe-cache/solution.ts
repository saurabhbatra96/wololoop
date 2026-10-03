// 16c - TS Warm-up 6: Sharing Work Between Callers: reference solution.


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
