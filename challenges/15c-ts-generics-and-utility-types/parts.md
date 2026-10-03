## Generics and utility types

Helpers you'd put in a `utils.ts`, typed so callers get precise types back.

```ts
groupBy<T, K extends PropertyKey>(items: readonly T[], key: (item: T) => K): Partial<Record<K, T[]>>
pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>
updateMeeting(meeting: Meeting, patch: Partial<Omit<Meeting, "id">>): Meeting
sortBy<T>(items: readonly T[], ...keys: ((item: T) => string | number)[]): T[]
```

- `groupBy` keeps items in their original order within each group. Why
  `Partial`? With `K = "even" | "odd"`, a plain `Record` promises both keys
  exist, and they don't if every number is odd.
- `pick` returns a new object with just those keys; the **type** must know
  which keys it has (the tests check that `pick(m, ["id"]).title` doesn't
  compile).
- `updateMeeting` returns a new meeting and leaves the original alone. The
  patch type makes `id` unpatchable. Keys the patch sets to `undefined` are
  ignored rather than blanking the field.
- `sortBy` sorts a copy by the first key, then the next to break ties, and
  keeps the original order for full ties (JavaScript's sort is stable).

> A likely follow-up: "what's the difference between `interface` and `type`?"
> (Interfaces merge and can be extended; type aliases can name unions,
> tuples and mapped types. For object shapes, either is fine — be consistent.)
