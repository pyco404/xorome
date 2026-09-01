import { getSupabase } from "../supabase/client.js";
import { postTweet, isXConfigured } from "./client.js";
import type { PostRow } from "../types/index.js";

export interface PublishResult {
  success: boolean;
  xPostId?: string;
  error?: string;
}

// Posts a post's content to X and updates its row — status: 'posted',
// x_post_id, posted_at on success. On failure the row is left as-is (still
// 'pending' or 'approved') so it can be retried rather than silently lost.
export async function publishPost(post: Pick<PostRow, "id" | "content" | "in_reply_to_id">): Promise<PublishResult> {
  if (!isXConfigured()) {
    return { success: false, error: "X credentials not configured" };
  }

  let tweet;
  try {
    tweet = await postTweet(post.content, post.in_reply_to_id ?? undefined);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("posts")
    .update({ status: "posted", x_post_id: tweet.id, posted_at: new Date().toISOString() })
    .eq("id", post.id);

  if (error) {
    return { success: false, xPostId: tweet.id, error: `posted to X (${tweet.id}) but failed to update DB: ${error.message}` };
  }

  return { success: true, xPostId: tweet.id };
}
