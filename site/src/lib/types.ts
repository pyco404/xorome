export type SessionStatus = "running" | "completed" | "failed";

export interface PublicSession {
  id: string;
  generation: number;
  started_at: string;
  ended_at: string | null;
  status: SessionStatus;
}

export type EventType =
  | "session_start"
  | "session_end"
  | "item_seen"
  | "item_read"
  | "artifact"
  | "post"
  | "post_candidate"
  | "reply"
  | "journal"
  | "error"
  | "unprompted";

export interface PublicEvent {
  id: string;
  session_id: string | null;
  generation: number | null;
  ts: string;
  type: EventType;
  payload: Record<string, unknown>;
  source_url: string | null;
}

export type LedgerCategory = "api" | "infra" | "domain" | "funding";

export interface PublicLedgerEntry {
  ts: string;
  amount_usd: number;
  category: LedgerCategory;
  description: string;
  tx_signature: string | null;
}

export type PostCategory = "opinion" | "reply" | "artifact" | "process" | "reflection";

export interface PublicPost {
  ts: string;
  category: PostCategory;
  content: string;
  event_ids: string[];
  x_post_id: string | null;
}
