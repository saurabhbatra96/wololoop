// 16c - TS Warm-up 6: Sharing Work Between Callers
//
// Fill in load() and invalidate(). The state you'll probably want is sketched out.

function createLoader<K, V>(
  fetch: (key: K) => Promise<V>,
  options: { ttlMs?: number; now?: () => number } = {},
): { load(key: K): Promise<V>; invalidate(key: K): void } {
  const ttlMs = options.ttlMs ?? Infinity;
  const now = options.now ?? Date.now;
  const cache = new Map<K, { value: V; at: number }>(); // successes, with when they arrived
  const inFlight = new Map<K, Promise<V>>(); // fetches still running

  return {
    /**
     * - A cached value younger than ttlMs: return it.
     * - A fetch for this key already running: return THAT promise (one request, many callers).
     * - Otherwise: start a fetch. Cache it if it succeeds; don't cache a failure.
     */
    load(key) {
      throw new NotImplementedError("load");
    },
    /**
     * Forget the cached value. If a fetch is running right now, its result must NOT land in the
     * cache when it arrives (it may be the stale data you're throwing away) - though its existing
     * callers still get it. You'll need a little extra state for that.
     */
    invalidate(key) {
      throw new NotImplementedError("invalidate");
    },
  };
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  let requests = 0;
  const loader = createLoader(async (id: string) => {
    requests++;
    await new Promise((r) => setTimeout(r, 100));
    return "note " + id;
  });
  console.log(await Promise.all([loader.load("n1"), loader.load("n1"), loader.load("n2")]), "requests:", requests);
});
