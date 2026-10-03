## Who's signed in? (context)

Half the components in an app need the current user: avatars, greetings,
"shared by you" labels. Passing it through every layer of props is prop
drilling; context is the fix.

```tsx
export interface User { name: string; email: string }

export function CurrentUserProvider({ user, children }: { user: User; children: React.ReactNode }): JSX.Element
export function useCurrentUser(): User
export function Avatar(): JSX.Element
export function Greeting(): JSX.Element
```

- `useCurrentUser()` reads the context. Used outside a provider, it throws
  `Error("useCurrentUser must be used inside <CurrentUserProvider>")`. Create
  the context with `createContext<User | null>(null)` so "no provider" is
  something you can detect — and so the hook returns `User`, not `User | null`.
- `Avatar` renders the user's initials in a `<span>` whose `title` is their
  email: `"Oat Benson"` → `OB`, `"Oat"` → `O`, `"Oat van der Benson"` → `OB`
  (first and last word), upper-cased.
- `Greeting` renders `<p>Hi, Oat</p>` — the first name.
- A new `user` prop on the provider updates every consumer.

> Expect "when would you *not* use context?" Context re-renders every consumer
> when its value changes, so it suits slow-changing values (user, theme,
> locale), not a text field's keystrokes.
