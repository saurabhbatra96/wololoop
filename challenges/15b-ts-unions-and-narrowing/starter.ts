// 15b - TS Warm-up 2: Unions and Narrowing
//
// Fill in the three function bodies.

type NoteEvent =
  | { kind: "created"; noteId: string; at: string; title: string }
  | { kind: "renamed"; noteId: string; at: string; from: string; to: string }
  | { kind: "shared"; noteId: string; at: string; with: string[] }
  | { kind: "deleted"; noteId: string; at: string };

/**
 * One line of history:
 *   Created "Standup"
 *   Renamed "Standup" to "Daily standup"
 *   Shared with oat@granola.ai      (one person)
 *   Shared with 3 people            (more than one)
 *   Deleted
 */
function describe(event: NoteEvent): string {
  switch (event.kind) {
    case "created":
      throw new NotImplementedError("describe: created");
    case "renamed":
      throw new NotImplementedError("describe: renamed");
    case "shared":
      throw new NotImplementedError("describe: shared");
    case "deleted":
      throw new NotImplementedError("describe: deleted");
    default: {
      // The exhaustiveness check: `event` is `never` here only because every kind has a case above.
      // Delete a case (or add a fifth kind to NoteEvent) and this line stops compiling.
      const unreachable: never = event;
      throw new Error("unknown event " + JSON.stringify(unreachable));
    }
  }
}

/** Replay events in `at` order (they arrive shuffled): noteId -> latest title. Deleted notes are absent. */
function currentTitles(events: readonly NoteEvent[]): Map<string, string> {
  throw new NotImplementedError("currentTitles");
}

/**
 * Minutes, or null if the input isn't a duration.
 *   numbers: passed through if finite and >= 0
 *   strings: "45", "45m", "1h", "1h30m", "1h 30m" (any case, surrounding spaces ok)
 */
function parseDuration(input: string | number): number | null {
  throw new NotImplementedError("parseDuration");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  console.log(describe({ kind: "created", noteId: "n1", at: "2026-10-01T09:00:00Z", title: "Standup" }));
  console.log(parseDuration("1h 30m"), parseDuration(45), parseDuration("soon"));
});
