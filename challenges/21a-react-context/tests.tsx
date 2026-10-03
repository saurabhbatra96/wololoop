// Tests for 21a - React 13: Context.

import { CurrentUserProvider, useCurrentUser, Avatar, Greeting } from "./your_code";
const OAT = { name: "Oat Benson", email: "oat@granola.ai" };

/** console.error calls made while fn runs (React reports render errors there too). */
function quietly<T>(fn: () => T): T {
  const original = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = original;
  }
}

test(1, "Avatar shows initials, with the email as a title", () => {
  render(<CurrentUserProvider user={OAT}><Avatar /></CurrentUserProvider>);
  const avatar = screen.getByText("OB");
  assertEqual(avatar.getAttribute("title"), "oat@granola.ai");
});

test(1, "initials: one name, many names, lower case", () => {
  const cases: [string, string][] = [["Oat", "O"], ["Oat van der Benson", "OB"], ["raisin patel", "RP"]];
  for (const [name, want] of cases) {
    const view = render(<CurrentUserProvider user={{ name, email: "x@y.z" }}><Avatar /></CurrentUserProvider>);
    assertEqual(view.container.textContent, want, name);
    view.unmount();
  }
});

test(1, "Greeting uses the first name", () => {
  render(<CurrentUserProvider user={OAT}><div><section><Greeting /></section></div></CurrentUserProvider>);
  screen.getByText("Hi, Oat");
});

test(1, "a new user reaches every consumer", () => {
  const view = render(<CurrentUserProvider user={OAT}><Avatar /><Greeting /></CurrentUserProvider>);
  view.rerender(<CurrentUserProvider user={{ name: "Raisin Patel", email: "raisin@granola.ai" }}><Avatar /><Greeting /></CurrentUserProvider>);
  screen.getByText("RP");
  screen.getByText("Hi, Raisin");
});

test(1, "outside a provider, the hook throws a helpful error", () => {
  quietly(() => assertThrows(() => render(<Greeting />), "useCurrentUser must be used inside <CurrentUserProvider>"));
});

test(1, "the hook's type is User, not User | null", () => {
  function Probe() {
    const user = useCurrentUser();
    const email: string = user.email; // would not compile if the hook returned User | null
    return <span>{email}</span>;
  }
  render(<CurrentUserProvider user={OAT}><Probe /></CurrentUserProvider>);
  screen.getByText("oat@granola.ai");
});
