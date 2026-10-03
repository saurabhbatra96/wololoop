// 21a - React 13: Context
//
// Fill in the provider, the hook, and the two consumers. Run (Ctrl+Enter) renders the preview().

import { createContext, useContext, type ReactNode } from "react";

export interface User {
  name: string;
  email: string;
}

// `null` means "no provider above me" - which is what lets useCurrentUser detect misuse.
const CurrentUserContext = createContext<User | null>(null);

export function CurrentUserProvider({ user, children }: { user: User; children: ReactNode }) {
  // TODO: <CurrentUserContext.Provider value={...}>
  return <>{children}</>;
}

/** The current user. Outside a provider: throw Error("useCurrentUser must be used inside <CurrentUserProvider>"). */
export function useCurrentUser(): User {
  throw new NotImplementedError("useCurrentUser");
}

/** Initials in a <span title={email}>: "Oat Benson" -> OB, "Oat" -> O, "Oat van der Benson" -> OB. */
export function Avatar() {
  return <span>TODO</span>;
}

/** <p>Hi, Oat</p> - the first name. */
export function Greeting() {
  return <p>TODO</p>;
}

preview(() => (
  <CurrentUserProvider user={{ name: "Oat Benson", email: "oat@granola.ai" }}>
    <Avatar /> <Greeting />
  </CurrentUserProvider>
));
