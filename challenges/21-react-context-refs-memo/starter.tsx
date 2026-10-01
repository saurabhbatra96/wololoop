// 21 - Context, Refs and Memo
//
// Run (Ctrl+Enter) renders the preview() at the bottom into the Preview tab.

import { createContext, useContext, type ReactNode } from "react";

export interface User {
  name: string;
  email: string;
}

export function CurrentUserProvider({ user, children }: { user: User; children: ReactNode }) {
  // TODO: provide the user through context
  return <>{children}</>;
}

export function useCurrentUser(): User {
  throw new NotImplementedError("useCurrentUser");
}

export function Avatar() {
  return <span>TODO</span>;
}

export function Greeting() {
  return <p>TODO</p>;
}

preview(() => (
  <CurrentUserProvider user={{ name: "Oat Benson", email: "oat@granola.ai" }}>
    <Avatar /> <Greeting />
  </CurrentUserProvider>
));
