import { getSupabase } from "../supabase/client.js";
import type { PostCategory } from "../types/index.js";

// Spec lists 4 opinion / 2 reply / 1 artifact / 1 process / 1 reflection as
// the "daily distribution" for 8 posts/day — the numbers sum to 9, not 8.
// Treated as proportions (4:2:1:1:1 of 9 shares), not a literal daily
// quota, which is what "steer toward these ratios over a rolling window"
// already implies rather than an exact per-day count.
const CATEGORY_WEIGHTS: Record<PostCategory, number> = {
  opinion: 4,
  reply: 2,
  artifact: 1,
  process: 1,
  reflection: 1,
};

const ALL_CATEGORIES = Object.keys(CATEGORY_WEIGHTS) as PostCategory[];
const TOTAL_WEIGHT = ALL_CATEGORIES.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c], 0);

// ~3 days of posts at one/session, 8/day — enough sample to steer against
// without being so long that a bad week takes forever to correct.
const ROLLING_WINDOW = 24;

function pickWeightedCold(): PostCategory {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const c of ALL_CATEGORIES) {
    r -= CATEGORY_WEIGHTS[c];
    if (r <= 0) return c;
  }
  return ALL_CATEGORIES[0]!;
}

// Picks the category furthest behind its target share of the rolling
// window — not sampled independently each session, per spec.
export async function pickCategory(): Promise<PostCategory> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("category")
    .order("ts", { ascending: false })
    .limit(ROLLING_WINDOW);
  if (error) throw error;

  const recent = data ?? [];
  if (recent.length === 0) return pickWeightedCold();

  const counts: Record<PostCategory, number> = {
    opinion: 0,
    reply: 0,
    artifact: 0,
    process: 0,
    reflection: 0,
  };
  for (const row of recent) counts[row.category as PostCategory]++;

  let best: PostCategory = ALL_CATEGORIES[0]!;
  let bestDeficit = -Infinity;
  for (const c of ALL_CATEGORIES) {
    const targetShare = CATEGORY_WEIGHTS[c] / TOTAL_WEIGHT;
    const actualShare = counts[c] / recent.length;
    const deficit = targetShare - actualShare;
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      best = c;
    }
  }
  return best;
}
