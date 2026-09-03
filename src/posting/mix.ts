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

// Weighted random permutation (not just a single pick) — used only when
// there's no post history yet to compute a deficit against.
function pickWeightedColdOrder(): PostCategory[] {
  const remaining = [...ALL_CATEGORIES];
  const order: PostCategory[] = [];
  while (remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c], 0);
    let r = Math.random() * totalWeight;
    let picked = remaining[0]!;
    for (const c of remaining) {
      r -= CATEGORY_WEIGHTS[c];
      if (r <= 0) {
        picked = c;
        break;
      }
    }
    order.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }
  return order;
}

// Every category ranked by how far behind its target share of the rolling
// window it is, most-starved first — not just the single best pick.
// Necessary because a category can be "picked" but structurally unable to
// produce a post this session (reply with no mentions read, process with
// no errors), in which case buildContext falls back and the resulting
// post gets recorded under the fallback's category, not the one that was
// actually chosen. If pickCategory only ever returned that one starved
// pick, a category stuck at zero actual posts (reply, until real X
// mentions exist) would keep winning the deficit forever and permanently
// starve every other under-served category behind it. Returning an order
// lets the caller try the next-most-deficient category instead of
// collapsing straight to opinion.
export async function pickCategoryOrder(): Promise<PostCategory[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("posts")
    .select("category")
    .order("ts", { ascending: false })
    .limit(ROLLING_WINDOW);
  if (error) throw error;

  const recent = data ?? [];
  if (recent.length === 0) return pickWeightedColdOrder();

  const counts: Record<PostCategory, number> = {
    opinion: 0,
    reply: 0,
    artifact: 0,
    process: 0,
    reflection: 0,
  };
  for (const row of recent) counts[row.category as PostCategory]++;

  const deficitOf = (c: PostCategory) => CATEGORY_WEIGHTS[c] / TOTAL_WEIGHT - counts[c] / recent.length;
  return [...ALL_CATEGORIES].sort((a, b) => deficitOf(b) - deficitOf(a));
}
