// 13 - Typed Endpoints for the Notes API
//
// Query parameters follow docs.granola.ai/api-reference/list-notes.

type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E[] };

type ErrorCode =
  | "unknown_parameter"
  | "invalid_integer"
  | "out_of_range"
  | "invalid_date"
  | "invalid_format"
  | "conflict"
  | "missing"               // needed later
  | "duplicate_parameter";  // needed later

interface ValidationError {
  param: string;
  code: ErrorCode;
  message: string; // for humans; tests don't check the wording
}

interface ListNotesQuery {
  page_size: number;
  created_after?: Date;
  created_before?: Date;
  updated_after?: Date;
  folder_id?: string;
  cursor?: string;
}

function parseListNotesQuery(raw: Record<string, string>): Result<ListNotesQuery, ValidationError> {
  throw new NotImplementedError("parseListNotesQuery");
}

main(() => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  console.log(parseListNotesQuery({ page_size: "5", created_after: "2026-01-27" }));
  console.log(parseListNotesQuery({ pagesize: "30", folder_id: "fol_nope" }));
});
