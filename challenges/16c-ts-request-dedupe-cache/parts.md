## Sharing work between callers

Three components on one screen all want note `n1`. You want one request.

```ts
createLoader<K, V>(
  fetch: (key: K) => Promise<V>,
  options?: { ttlMs?: number; now?: () => number },
): { load(key: K): Promise<V>; invalidate(key: K): void }
```

- Calls to `load(key)` while a fetch for that key is **in flight** share that
  one fetch — same promise.
- A success is cached for `ttlMs` (default: forever), timed with `now()`
  (default `Date.now`). After that, the next `load` fetches again.
- A **failure isn't cached**: the callers waiting on it all reject, and the
  next `load` tries again.
- `invalidate(key)` forgets the cached value. And the subtle one: if a fetch
  is **in flight** when you invalidate, its result must **not** land in the
  cache when it arrives — it may be the stale data you just threw away. (Its
  existing callers still get it.)

This is the core of what React Query and SWR do. Knowing why the in-flight
case is tricky is a good senior signal.
