## When things fail

```ts
settle<T>(promises: readonly Promise<T>[]): Promise<{ values: T[]; errors: unknown[] }>
firstSuccessful<T>(attempts: readonly (() => Promise<T>)[]): Promise<T>
retry<T>(fn: () => Promise<T>, options: {
  attempts: number;
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;   // defaults to the sleep() in the starter
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
