// 11 - Granola Notes API Client: reference solution, all three parts.

interface User {
  name: string | null;
  email: string;
}

interface NoteSummary {
  id: string;
  object: "note";
  title: string | null;
  owner: User;
  created_at: string;
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
  path: string;
  query: Record<string, string>;
}

interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

type Transport = (req: ApiRequest) => Promise<ApiResponse>;

// Part 3 shapes
interface Note extends NoteSummary {
  web_url: string;
  attendees: User[];
  summary_markdown: string | null;
}

interface TranscriptItem {
  speaker: { source: "microphone" | "speaker"; attribution?: "me" | "them"; name?: string };
  text: string;
  start_time: string;
  end_time: string;
}

interface NoteWithTranscript extends Note {
  transcript: TranscriptItem[];
}

type NoteResult =
  | { id: string; ok: true; note: Note }
  | { id: string; ok: false; error: GranolaApiError };

// ------------------------------------------------------------------ errors

type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "server_error"
  | "network"
  | "transcript_too_large"
  | "unknown";

class GranolaApiError extends Error {
  readonly retryable: boolean;

  constructor(
    message: string,
    readonly status: number | null,
    readonly code: ApiErrorCode,
    readonly attempts = 1,
    readonly retryAfterMs: number | null = null
  ) {
    super(message);
    this.name = "GranolaApiError";
    this.retryable = status === null || status === 408 || status === 429 || status >= 500;
  }

  static fromResponse(res: ApiResponse, attempts: number): GranolaApiError {
    const bodyCode = isRecord(res.body) && typeof res.body.code === "string" ? res.body.code : "";
    const code: ApiErrorCode =
      res.status === 413 || bodyCode === "TRANSCRIPT_TOO_LARGE" ? "transcript_too_large"
      : res.status === 400 ? "bad_request"
      : res.status === 401 ? "unauthorized"
      : res.status === 404 ? "not_found"
      : res.status === 429 ? "rate_limited"
      : res.status >= 500 ? "server_error"
      : "unknown";
    const retryAfter = Number(res.headers["retry-after"]);
    const retryAfterMs = res.headers["retry-after"] !== undefined && Number.isFinite(retryAfter)
      ? retryAfter * 1000 : null;
    return new GranolaApiError("HTTP " + res.status + " (" + code + ")", res.status, code, attempts, retryAfterMs);
  }

  withAttempts(attempts: number): GranolaApiError {
    return new GranolaApiError(this.message, this.status, this.code, attempts, this.retryAfterMs);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// ------------------------------------------------------------------ client

interface ClientOptions {
  transport: Transport;
  pageSize?: number;
  sleep?: (ms: number) => Promise<void>;
  retry?: { maxAttempts?: number; baseDelayMs?: number };
}

const NOTE_ID = /^not_[A-Za-z0-9]{14}$/;

class GranolaClient {
  private readonly transport: Transport;
  private readonly pageSize: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;

  constructor(options: ClientOptions) {
    const pageSize = options.pageSize ?? 10;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 30) {
      throw new RangeError("pageSize must be an integer from 1 to 30, got " + pageSize);
    }
    this.transport = options.transport;
    this.pageSize = pageSize;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxAttempts = options.retry?.maxAttempts ?? 4;
    this.baseDelayMs = options.retry?.baseDelayMs ?? 250;
  }

  async *listNotes(filter: NoteFilter = {}): AsyncGenerator<NoteSummary> {
    const base: Record<string, string | undefined> = {
      created_after: filter.createdAfter,
      created_before: filter.createdBefore,
      updated_after: filter.updatedAfter,
      folder_id: filter.folderId,
      page_size: String(this.pageSize),
    };
    yield* this.paginate<NoteSummary>("/v1/notes", base, "notes");
  }

  getNote(id: string): Promise<Note>;
  getNote(id: string, options: { include: "transcript" }): Promise<NoteWithTranscript>;
  async getNote(id: string, options?: { include: "transcript" }): Promise<Note | NoteWithTranscript> {
    if (!NOTE_ID.test(id)) throw new TypeError("not a Granola note id: " + JSON.stringify(id));
    const path = "/v1/notes/" + id;
    if (!options) return (await this.request(path, {})) as Note;

    try {
      return (await this.request(path, { include: "transcript" })) as NoteWithTranscript;
    } catch (err) {
      if (!(err instanceof GranolaApiError) || err.code !== "transcript_too_large") throw err;
    }
    const note = (await this.request(path, {})) as Note;
    const transcript: TranscriptItem[] = [];
    for await (const item of this.paginate<TranscriptItem>(path + "/transcript", { page_size: "100" }, "transcript")) {
      transcript.push(item);
    }
    return { ...note, transcript };
  }

  async getNotes(ids: string[], options: { concurrency?: number } = {}): Promise<NoteResult[]> {
    const concurrency = Math.max(1, options.concurrency ?? 4);
    const results = new Array<NoteResult>(ids.length);
    let next = 0;

    const worker = async () => {
      while (next < ids.length) {
        const index = next++;
        const id = ids[index];
        try {
          results[index] = { id, ok: true, note: await this.getNote(id) };
        } catch (err) {
          const error = err instanceof GranolaApiError ? err
            : new GranolaApiError(err instanceof Error ? err.message : String(err), null, "unknown");
          results[index] = { id, ok: false, error };
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
    return results;
  }

  // ---------------------------------------------------------------- plumbing

  private async *paginate<T>(path: string, query: Record<string, string | undefined>, key: string): AsyncGenerator<T> {
    let cursor: string | null = null;
    do {
      const body = await this.request(path, { ...query, cursor: cursor ?? undefined });
      if (!isRecord(body) || !Array.isArray(body[key])) {
        throw new GranolaApiError("malformed page from " + path, 200, "unknown");
      }
      yield* body[key] as T[];
      if (!body.hasMore) return;
      if (typeof body.cursor !== "string" || !body.cursor) {
        throw new GranolaApiError("server said hasMore but sent no cursor", 200, "unknown");
      }
      cursor = body.cursor;
    } while (true);
  }

  private async request(path: string, rawQuery: Record<string, string | undefined>): Promise<unknown> {
    const query: Record<string, string> = {};
    for (const [k, v] of Object.entries(rawQuery)) if (v !== undefined) query[k] = v;

    for (let attempt = 1; ; attempt++) {
      let error: GranolaApiError;
      try {
        const res = await this.transport({ method: "GET", path, query });
        if (res.status >= 200 && res.status < 300) return res.body;
        error = GranolaApiError.fromResponse(res, attempt);
      } catch (err) {
        if (err instanceof GranolaApiError) throw err;
        error = new GranolaApiError("network error: " + (err instanceof Error ? err.message : String(err)),
                                    null, "network", attempt);
      }
      if (!error.retryable || attempt >= this.maxAttempts) throw error.withAttempts(attempt);
      await this.sleep(error.retryAfterMs ?? this.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}

main(async () => {
  const pages: Record<string, ListNotesPage> = {
    "": { notes: [], hasMore: true, cursor: "c1" },
    c1: { notes: [], hasMore: false, cursor: null },
  };
  const client = new GranolaClient({
    pageSize: 2,
    transport: async (req) => {
      console.log(req.method, req.path, JSON.stringify(req.query));
      return { status: 200, headers: {}, body: pages[req.query.cursor ?? ""] };
    },
  });
  for await (const note of client.listNotes({ folderId: "fol_4y6LduVdwSKC27" })) console.log(note.title);
});
