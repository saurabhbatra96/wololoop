## Promises, in order and all at once

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
