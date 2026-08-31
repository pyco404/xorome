import { getSupabase } from "../supabase/client.js";
import type { NewPost } from "../types/index.js";

export async function savePost(post: NewPost): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("posts").insert(post).select("id").single();
  if (error) throw error;
  return data.id;
}
