import type {
  Session,
  NewSession,
  EventRow,
  NewEvent,
  PostRow,
  NewPost,
  LedgerRow,
  NewLedgerEntry,
} from "./index.js";

// Hand-written to match supabase/migrations/*.sql. Kept minimal (just what
// the supabase-js client needs for insert/update type inference) rather
// than generated, since there's no linked Supabase CLI project yet.
export interface Database {
  public: {
    Tables: {
      sessions: {
        Row: Session;
        Insert: NewSession;
        Update: Partial<NewSession>;
        Relationships: [];
      };
      events: {
        Row: EventRow;
        Insert: NewEvent;
        Update: Partial<NewEvent>;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: NewPost;
        Update: Partial<PostRow>;
        Relationships: [];
      };
      ledger: {
        Row: LedgerRow;
        Insert: NewLedgerEntry;
        Update: Partial<NewLedgerEntry>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
