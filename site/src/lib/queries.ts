import { supabase } from "./supabase";
import type { PublicEvent, PublicLedgerEntry, PublicPost, PublicSession } from "./types";

export async function fetchSessions(): Promise<PublicSession[]> {
  const { data, error } = await supabase
    .from("public_sessions")
    .select("*")
    .order("started_at", { ascending: true })
    .returns<PublicSession[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLatestEvent(): Promise<PublicEvent | null> {
  const { data, error } = await supabase
    .from("public_events")
    .select("*")
    .order("ts", { ascending: false })
    .limit(1)
    .returns<PublicEvent[]>();
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function fetchSessionEvents(sessionId: string): Promise<PublicEvent[]> {
  const { data, error } = await supabase
    .from("public_events")
    .select("*")
    .eq("session_id", sessionId)
    .order("ts", { ascending: true })
    .returns<PublicEvent[]>();
  if (error) throw error;
  return data ?? [];
}

export async function fetchLedger(): Promise<PublicLedgerEntry[]> {
  const { data, error } = await supabase
    .from("public_ledger")
    .select("*")
    .order("ts", { ascending: true })
    .returns<PublicLedgerEntry[]>();
  if (error) throw error;
  return data ?? [];
}

const RECENT_POSTS_LIMIT = 20;

export async function fetchPosts(): Promise<PublicPost[]> {
  const { data, error } = await supabase
    .from("public_posts")
    .select("*")
    .order("ts", { ascending: false })
    .limit(RECENT_POSTS_LIMIT)
    .returns<PublicPost[]>();
  if (error) throw error;
  return data ?? [];
}

// Posts don't carry a source_url themselves — it lives on the event(s)
// they reference. Resolves event_ids back to real rows so SAID can show
// where each post came from.
export async function fetchEventsByIds(ids: string[]): Promise<PublicEvent[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("public_events")
    .select("*")
    .in("id", ids)
    .returns<PublicEvent[]>();
  if (error) throw error;
  return data ?? [];
}
