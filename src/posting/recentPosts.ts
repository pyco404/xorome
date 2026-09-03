import { getSupabase } from "../supabase/client.js";

export async function fetchRecentPostTexts(limit = 10): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("content")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => r.content);
}

// Opinion-only: which rhetorical move recent posts actually used
// (comparison, flat_claim, unanswerable_question, absurdity), stored in
// metadata at save time. Older posts predate this field and are simply
// absent, not a gap that needs backfilling.
export async function fetchRecentRhetoricalForms(limit = 10): Promise<string[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("metadata")
    .eq("category", "opinion")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? [])
    .map((r) => (r.metadata as Record<string, unknown> | null)?.rhetoricalForm)
    .filter((f): f is string => typeof f === "string");
}
