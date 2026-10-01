/* Wololoop React helpers - appended to harness.ts for .tsx challenges.
 *
 * A small, honest subset of React Testing Library and user-event: the same
 * names and, where they exist, the same semantics, so what you practise here is
 * what you'd write at work.
 *
 *   render(<App />)                 mount into the page; unmounted after each test
 *   screen.getByText / getByRole / getByLabelText / getByPlaceholderText / getByTestId
 *     ...and query*, getAll*, queryAll*, find* (async) variants
 *   within(element)                 the same queries, scoped to one element
 *   user.click / type / clear / selectOptions / keyboard   (all async - await them)
 *   waitFor(() => ...)              retry until it stops throwing (1s default)
 *   settle()                        let pending promises and effects run
 *   createDeferred<T>()             a promise you resolve or reject by hand
 *   preview(() => <App />)          what Run shows in the Preview tab
 */

declare const ReactDOMClient: {
  createRoot(container: Element): { render(node: React.ReactNode): void; unmount(): void };
};

type TextMatch = string | RegExp;
type RoleOptions = { name?: TextMatch };

const __mounted: { root: { unmount(): void }; container: HTMLElement }[] = [];

function render(ui: React.ReactNode): { container: HTMLElement; rerender(next: React.ReactNode): void; unmount(): void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  const mounted = { root, container };
  __mounted.push(mounted);
  React.act(() => root.render(ui));
  return {
    container,
    rerender: (next) => React.act(() => root.render(next)),
    unmount: () => {
      React.act(() => root.unmount());
      __mounted.splice(__mounted.indexOf(mounted), 1);
      container.remove();
    },
  };
}

afterEach(() => {
  for (const { root } of __mounted.splice(0)) React.act(() => root.unmount());
  document.body.innerHTML = "";
});

function preview(make: () => React.ReactNode): void {
  main(() => {
    const host = document.getElementById("root") ?? document.body.appendChild(document.createElement("div"));
    ReactDOMClient.createRoot(host).render(make());
  });
}

async function settle(): Promise<void> {
  await React.act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function waitFor<T>(check: () => T | Promise<T>, options: { timeout?: number; interval?: number } = {}): Promise<T> {
  const timeout = options.timeout ?? 1000;
  const interval = options.interval ?? 15;
  const started = Date.now();
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (Date.now() - started > timeout) throw err;
    }
    await React.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, interval));
    });
  }
}

function createDeferred<T = void>(): { promise: Promise<T>; resolve(value: T): void; reject(err: unknown): void } {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/* ------------------------------------------------------------------ queries */

const __norm = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

function __matches(text: string, match: TextMatch): boolean {
  if (typeof match === "string") return __norm(text) === __norm(match);
  match.lastIndex = 0;
  return match.test(__norm(text));
}

function __isHidden(el: Element): boolean {
  return Boolean(el.closest("[hidden], [aria-hidden='true']"));
}

function __all(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("*")).filter((el) => !__isHidden(el));
}

/** Text of an element's own text nodes, like Testing Library's getNodeText. */
function __ownText(el: Element): string {
  if (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "button")) return el.value;
  return Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
}

function __role(el: HTMLElement): string | null {
  const explicit = el.getAttribute("role");
  if (explicit) return explicit.split(" ")[0];
  const tag = el.tagName;
  if (tag === "BUTTON") return "button";
  if (tag === "A") return el.hasAttribute("href") ? "link" : null;
  if (/^H[1-6]$/.test(tag)) return "heading";
  if (tag === "UL" || tag === "OL") return "list";
  if (tag === "LI") return "listitem";
  if (tag === "TEXTAREA") return "textbox";
  if (tag === "SELECT") return (el as HTMLSelectElement).multiple ? "listbox" : "combobox";
  if (tag === "OPTION") return "option";
  if (tag === "IMG") return el.getAttribute("alt") ? "img" : null;
  if (tag === "NAV") return "navigation";
  if (tag === "MAIN") return "main";
  if (tag === "ARTICLE") return "article";
  if (tag === "DIALOG") return "dialog";
  if (tag === "FORM") return "form";
  if (tag === "TABLE") return "table";
  if (tag === "TR") return "row";
  if (tag === "TD") return "cell";
  if (tag === "TH") return "columnheader";
  if (tag === "INPUT") {
    const type = ((el as HTMLInputElement).getAttribute("type") ?? "text").toLowerCase();
    if (["button", "submit", "reset", "image"].includes(type)) return "button";
    if (type === "checkbox") return "checkbox";
    if (type === "radio") return "radio";
    if (type === "search") return "searchbox";
    if (type === "number") return "spinbutton";
    if (["text", "email", "tel", "url", ""].includes(type)) return "textbox";
  }
  return null;
}

const __NAME_FROM_CONTENT = new Set(["button", "link", "heading", "option", "cell", "columnheader", "row", "tab", "menuitem", "switch"]);

function __accessibleName(el: HTMLElement): string {
  const label = el.getAttribute("aria-label");
  if (label) return __norm(label);
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    return __norm(labelledBy.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" "));
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const labels = el.labels ? Array.from(el.labels).map((l) => l.textContent).join(" ") : "";
    if (__norm(labels)) return __norm(labels);
    if (el instanceof HTMLInputElement && ["submit", "button", "reset"].includes(el.type)) return __norm(el.value);
    return __norm(el.getAttribute("title") ?? el.getAttribute("placeholder") ?? "");
  }
  if (el instanceof HTMLImageElement) return __norm(el.alt);
  const role = __role(el);
  if (role && __NAME_FROM_CONTENT.has(role)) return __norm(el.textContent);
  return __norm(el.getAttribute("title") ?? "");
}

function __snapshot(root: Element): string {
  const html = root.innerHTML.replace(/></g, ">\n<");
  return html.length > 1500 ? html.slice(0, 1500) + "\n...(truncated)" : html || "(empty)";
}

type __Finder = (root: Element) => HTMLElement[];

function __queries(scope: () => Element) {
  const make = <Args extends unknown[]>(finder: (...args: Args) => __Finder, describe: (...args: Args) => string) => {
    const all = (...args: Args) => finder(...args)(scope());
    const fail = (message: string) => new AssertionError(message + "\n\nThe page looks like:\n" + __snapshot(scope()));
    return {
      queryAll: all,
      getAll: (...args: Args) => {
        const found = all(...args);
        if (!found.length) throw fail("Unable to find any element " + describe(...args));
        return found;
      },
      query: (...args: Args) => {
        const found = all(...args);
        if (found.length > 1) throw fail("Found " + found.length + " elements " + describe(...args) + " - expected at most one");
        return found[0] ?? null;
      },
      get: (...args: Args) => {
        const found = all(...args);
        if (found.length !== 1) {
          throw fail((found.length ? "Found " + found.length + " elements " : "Unable to find an element ") + describe(...args) +
                     (found.length ? " - use getAll* if you expect several" : ""));
        }
        return found[0];
      },
    };
  };

  const text = make(
    (m: TextMatch) => (root) => __all(root).filter((el) => el.tagName !== "SCRIPT" && el.tagName !== "STYLE" && __matches(__ownText(el), m)),
    (m: TextMatch) => "with the text " + String(typeof m === "string" ? JSON.stringify(m) : m));
  const role = make(
    (r: string, o: RoleOptions = {}) => (root) => __all(root).filter((el) =>
      __role(el) === r && (o.name === undefined || __matches(__accessibleName(el), o.name))),
    (r: string, o: RoleOptions = {}) => "with the role " + JSON.stringify(r) +
      (o.name !== undefined ? " and name " + String(typeof o.name === "string" ? JSON.stringify(o.name) : o.name) : ""));
  const label = make(
    (m: TextMatch) => (root) => {
      const out = new Set<HTMLElement>();
      for (const l of Array.from(root.querySelectorAll("label"))) {
        if (__matches(l.textContent ?? "", m) && l.control && !__isHidden(l.control)) out.add(l.control as HTMLElement);
      }
      for (const el of __all(root)) if (el.hasAttribute("aria-label") && __matches(el.getAttribute("aria-label")!, m)) out.add(el);
      return Array.from(out);
    },
    (m: TextMatch) => "with the label " + String(typeof m === "string" ? JSON.stringify(m) : m));
  const placeholder = make(
    (m: TextMatch) => (root) => __all(root).filter((el) => el.hasAttribute("placeholder") && __matches(el.getAttribute("placeholder")!, m)),
    (m: TextMatch) => "with the placeholder " + String(typeof m === "string" ? JSON.stringify(m) : m));
  const testId = make(
    (id: string) => (root) => __all(root).filter((el) => el.getAttribute("data-testid") === id),
    (id: string) => "with data-testid " + JSON.stringify(id));

  return {
    getByText: text.get, queryByText: text.query, getAllByText: text.getAll, queryAllByText: text.queryAll,
    findByText: (m: TextMatch) => waitFor(() => text.get(m)),
    findAllByText: (m: TextMatch) => waitFor(() => text.getAll(m)),
    getByRole: role.get, queryByRole: role.query, getAllByRole: role.getAll, queryAllByRole: role.queryAll,
    findByRole: (r: string, o?: RoleOptions) => waitFor(() => role.get(r, o)),
    findAllByRole: (r: string, o?: RoleOptions) => waitFor(() => role.getAll(r, o)),
    getByLabelText: label.get, queryByLabelText: label.query, getAllByLabelText: label.getAll,
    findByLabelText: (m: TextMatch) => waitFor(() => label.get(m)),
    getByPlaceholderText: placeholder.get, queryByPlaceholderText: placeholder.query,
    getByTestId: testId.get, queryByTestId: testId.query, getAllByTestId: testId.getAll, queryAllByTestId: testId.queryAll,
    findByTestId: (id: string) => waitFor(() => testId.get(id)),
  };
}

// `screen` already exists in the DOM (window.screen, the monitor), so the queries are merged into
// its type and attached to the object - which is what lets you write screen.getByText as usual.
type __Queries = ReturnType<typeof __queries>;
interface Screen extends __Queries {}
Object.assign(screen, __queries(() => document.body));

function within(element: Element) {
  return __queries(() => element);
}

/* ------------------------------------------------------------ user events */

function __setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // React tracks the last value it saw; the prototype's setter goes around that, so onChange fires.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function __key(el: Element, type: "keydown" | "keyup", key: string): boolean {
  return el.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
}

function __editable(el: Element): HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    throw new AssertionError("can only type into an <input> or <textarea>, got <" + el.tagName.toLowerCase() + ">");
  }
  return el;
}

const user = {
  /** Clicks like a user: focus moves first (firing blur on whatever had it), then the click. */
  async click(el: Element): Promise<void> {
    const target = el as HTMLElement;
    await React.act(async () => {
      if (document.activeElement !== target && !(target as HTMLButtonElement).disabled) {
        (document.activeElement as HTMLElement | null)?.blur();
        target.focus();
      }
    });
    await React.act(async () => {
      target.click();
    });
  },

  /** Types character by character. "{Enter}" presses Enter (submitting an input's form); "{Backspace}" deletes. */
  async type(el: Element, text: string): Promise<void> {
    const field = __editable(el);
    if (field.disabled || field.readOnly) return;
    await React.act(async () => {
      field.focus();
    });
    for (const token of text.match(/\{[A-Za-z]+\}|[\s\S]/g) ?? []) {
      await React.act(async () => {
        if (token === "{Enter}") {
          const proceed = __key(field, "keydown", "Enter");
          if (proceed && field instanceof HTMLInputElement && field.form) field.form.requestSubmit();
          if (proceed && field instanceof HTMLTextAreaElement) __setValue(field, field.value + "\n");
          __key(field, "keyup", "Enter");
        } else if (token === "{Backspace}") {
          if (__key(field, "keydown", "Backspace")) __setValue(field, field.value.slice(0, -1));
          __key(field, "keyup", "Backspace");
        } else {
          if (__key(field, "keydown", token)) __setValue(field, field.value + token);
          __key(field, "keyup", token);
        }
      });
    }
  },

  async clear(el: Element): Promise<void> {
    const field = __editable(el);
    await React.act(async () => {
      field.focus();
      __setValue(field, "");
    });
  },

  async selectOptions(el: Element, value: string): Promise<void> {
    if (!(el instanceof HTMLSelectElement)) throw new AssertionError("selectOptions needs a <select>");
    await React.act(async () => {
      el.value = value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  },

  /** Presses a key on whatever has focus, e.g. user.keyboard("Escape"). */
  async keyboard(key: string): Promise<void> {
    const target = document.activeElement ?? document.body;
    await React.act(async () => {
      __key(target, "keydown", key);
      __key(target, "keyup", key);
    });
  },
};
