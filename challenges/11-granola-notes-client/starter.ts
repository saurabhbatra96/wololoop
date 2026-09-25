// 11 - Granola Notes API Client
//
// Shapes follow the public Granola API (docs.granola.ai). You never call
// fetch: every request goes through the injected Transport, so tests can
// play the server.

interface User {
  name: string | null;
  email: string;
}

interface NoteSummary {
  id: string; // "not_" + 14 alphanumerics
  object: "note";
  title: string | null;
  owner: User;
  created_at: string; // ISO 8601
  updated_at: string;
}

interface ListNotesPage {
  notes: NoteSummary[];
  hasMore: boolean;
  cursor: string | null;
}

interface NoteFilter {
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  folderId?: string;
}

interface ApiRequest {
  method: "GET";
  path: string; // e.g. "/v1/notes"
  query: Record<string, string>;
}

interface ApiResponse {
  status: number;
  headers: Record<string, string>; // lower-case names
  body: unknown; // parsed JSON
}

type Transport = (req: ApiRequest) => Promise<ApiResponse>;

class GranolaApiError extends Error {
  constructor(message: string, readonly status: number | null) {
    super(message);
    this.name = "GranolaApiError";
  }
}

class GranolaClient {
  constructor(options: { transport: Transport; pageSize?: number }) {
    throw new NotImplementedError("GranolaClient constructor");
  }

  async *listNotes(filter: NoteFilter = {}): AsyncGenerator<NoteSummary> {
    throw new NotImplementedError("listNotes");
  }
}

main(async () => {
  // Scratch space: Run (Ctrl+Enter) executes this; Run Tests skips it.
  const client = new GranolaClient({
    pageSize: 2,
    transport: async (req) => {
      console.log(req.method, req.path, JSON.stringify(req.query));
      return { status: 200, headers: {}, body: { notes: [], hasMore: false, cursor: null } };
    },
  });
  for await (const note of client.listNotes({ folderId: "fol_4y6LduVdwSKC27" })) console.log(note.title);
});
