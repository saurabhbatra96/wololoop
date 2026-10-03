// 21a - React 13: Context: reference solution.

import { createContext, useContext, type ReactNode } from "react";

export interface User {
  name: string;
  email: string;
}

const CurrentUserContext = createContext<User | null>(null);

export function CurrentUserProvider({ user, children }: { user: User; children: ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): User {
  const user = useContext(CurrentUserContext);
  if (!user) throw new Error("useCurrentUser must be used inside <CurrentUserProvider>");
  return user;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((w) => w[0]).join("").toUpperCase();
}

export function Avatar() {
  const user = useCurrentUser();
  return <span title={user.email}>{initials(user.name)}</span>;
}

export function Greeting() {
  const user = useCurrentUser();
  return <p>Hi, {user.name.trim().split(/\s+/)[0]}</p>;
}

preview(() => (
  <CurrentUserProvider user={{ name: "Oat Benson", email: "oat@granola.ai" }}>
    <Avatar /> <Greeting />
  </CurrentUserProvider>
));
