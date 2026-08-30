import { getSupabase } from "../supabase/client.js";
import type { RawItem } from "../types/index.js";

const LOOKBACK_DAYS = 60;

function itemKey(item: Pick<RawItem, "kind" | "externalId">): string {
  return `${item.kind}:${item.externalId}`;
}

// Dedupes against item_seen events from the last LOOKBACK_DAYS, plus
// within the current batch (the same repo can surface via both trending
// and releases in one run).
export async function filterUnseen(items: RawItem[]): Promise<RawItem[]> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("payload")
    .eq("type", "item_seen")
    .gte("ts", since)
    .limit(10000);

  if (error) throw error;

  const seen = new Set(
    (data ?? []).map((row) => {
      const p = (row as { payload: Record<string, unknown> }).payload;
      return `${p.kind}:${p.externalId}`;
    })
  );

  const out: RawItem[] = [];
  const localSeen = new Set<string>();
  for (const item of items) {
    const key = itemKey(item);
    if (seen.has(key) || localSeen.has(key)) continue;
    localSeen.add(key);
    out.push(item);
  }
  return out;
}
