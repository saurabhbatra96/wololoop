## Part 1 — Promises, in order and all at once

Nearly everything in a Granola-style app is async: fetching notes, saving
edits, waiting on transcripts. These are the building blocks, written by hand.

```ts
sleep(ms: number): Promise<void>
withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>
mapSeries<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]>
mapParallel<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]>
```

- `withTimeout` settles like `promise`, unless `ms` passes first — then it
  rejects with a `TimeoutError` (write the class: `extends Error`, with
  `name = "TimeoutError"`). Clear the timer when the promise wins.
- `mapSeries` runs `fn` **one at a time**: item 2 doesn't start until item 1
  has finished.
- `mapParallel` starts them **all at once**. Both return results in **input
  order**, whatever order they finish in.

> The question to expect: "the loop has an `await` inside `forEach` — why
> doesn't it wait?" (`forEach` ignores the promises its callback returns. Use
> `for...of` for series, `Promise.all(items.map(...))` for parallel.)

<!-- part -->

## Part 2 — When things fail

```ts
settle<T>(promises: readonly Promise<T>[]): Promise<{ values: T[]; errors: unknown[] }>
firstSuccessful<T>(attempts: readonly (() => Promise<T>)[]): Promise<T>
retry<T>(fn: () => Promise<T>, options: {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;   // defaults to your sleep()
}): Promise<T>
```

- `settle` waits for **every** promise, even after one fails, and splits the
  results. Both lists keep input order. (`Promise.allSettled` is allowed.)
- `firstSuccessful` tries the functions **in order**, one at a time, and
  resolves with the first success. Later functions are never called. If all
  fail, reject with an `AggregateError` holding every error, in order.
- `retry` calls `fn` up to `attempts` times, sleeping `delayMs` between tries
  (not before the first, not after the last). It rejects with the **last**
  error.

A caught error is `unknown` in strict TypeScript. Don't cast it to `Error`;
check with `instanceof` if you need `.message`.

<!-- part -->

## Part 3 — Sharing work between callers

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
