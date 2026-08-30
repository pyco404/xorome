export type EventType =
  | "session_start"
  | "session_end"
  | "item_seen"
  | "item_read"
  | "artifact"
  | "post"
  | "reply"
  | "journal"
  | "error"
  | "unprompted";

export type PostCategory =
  | "opinion"
  | "reply"
  | "artifact"
  | "process"
  | "reflection";

export type PostStatus = "pending" | "approved" | "rejected" | "posted";

export type LedgerCategory = "api" | "infra" | "domain" | "funding";

export type SessionStatus = "running" | "completed" | "failed";

// Declared as `type` rather than `interface`: interfaces don't structurally
// satisfy `Record<string, unknown>` in conditional-type checks, which is
// exactly what supabase-js's generated-types machinery needs (see
// types/database.ts) to resolve table Row/Insert/Update shapes. An
// interface here silently collapses every `.from(table)` call to `never`.
export type Session = {
  id: string;
  generation: number;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
  budget_usd_spent: number;
  notes: string | null;
};

// generation is a DB identity column — never settable on insert.
export type NewSession = Partial<
  Pick<Session, "status" | "notes" | "budget_usd_spent" | "started_at" | "ended_at">
>;

export type EventRow = {
  id: string;
  session_id: string | null;
  generation: number | null;
  ts: string;
  type: EventType;
  payload: Record<string, unknown>;
  source_url: string | null;
};

export type NewEvent = Omit<EventRow, "id" | "ts"> & {
  ts?: string;
};

export type PostRow = {
  id: string;
  session_id: string | null;
  generation: number | null;
  ts: string;
  category: PostCategory;
  status: PostStatus;
  content: string;
  in_reply_to_id: string | null;
  in_reply_to_url: string | null;
  event_ids: string[];
  metadata: Record<string, unknown>;
  x_post_id: string | null;
  posted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

export type NewPost = Omit<
  PostRow,
  "id" | "ts" | "status" | "x_post_id" | "posted_at" | "reviewed_at" | "reviewed_by"
> & {
  status?: PostStatus;
};

export type LedgerRow = {
  id: string;
  ts: string;
  session_id: string | null;
  amount_usd: number;
  category: LedgerCategory;
  description: string;
  tx_signature: string | null;
};

export type NewLedgerEntry = Omit<LedgerRow, "id" | "ts"> & {
  ts?: string;
};

// ---------------------------------------------------------------------------
// reading pipeline
// ---------------------------------------------------------------------------

export type SourceKind =
  | "arxiv"
  | "github_trending"
  | "github_release"
  | "github_issue"
  | "hn_story"
  | "hn_comment"
  | "rss"
  | "own_history"
  | "own_error"
  | "wildcard"
  | "x_timeline"
  | "x_mentions";

// One thing seen while reading: a paper, a repo, a thread, a comment. The
// unit that gets deduped, logged as item_seen, and optionally read in full.
export type RawItem = {
  kind: SourceKind;
  externalId: string;
  url: string | null;
  title: string;
  summary: string;
  publishedAt: string | null;
  raw?: Record<string, unknown>;
};

export type SourceError = {
  source: string;
  message: string;
  url?: string;
};
