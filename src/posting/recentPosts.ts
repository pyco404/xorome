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
