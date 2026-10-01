// 16 - TypeScript Warm-up: Async

function sleep(ms: number): Promise<void> {
  throw new NotImplementedError("sleep");
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  throw new NotImplementedError("withTimeout");
}

async function mapSeries<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  throw new NotImplementedError("mapSeries");
}

async function mapParallel<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  throw new NotImplementedError("mapParallel");
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const started = Date.now();
  await sleep(100);
  console.log("slept", Date.now() - started, "ms");
});
