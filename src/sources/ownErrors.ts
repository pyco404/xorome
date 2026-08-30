import { getSupabase } from "../supabase/client.js";
import { errorMessage } from "../lib/errors.js";
import type { RawItem, SourceError } from "../types/index.js";

const LOOKBACK_DAYS = 7;
const LIMIT = 2;

// Its own crashes, rate limits, failed calls from the last week. Where a
// framework breaks is better material than what it announces.
export async function fetchOwnErrors(errors: SourceError[]): Promise<RawItem[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getSupabase();

  try {
    const { data, error } = await supabase
      .from("events")
      .select("id, ts, payload, source_url")
      .eq("type", "error")
      .gte("ts", since)
      .order("ts", { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!data) return [];

    const rows = data as { id: string; ts: string; payload: Record<string, unknown>; source_url: string | null }[];
    const shuffled = [...rows].sort(() => Math.random() - 0.5).slice(0, LIMIT);

    return shuffled.map((row) => ({
      kind: "own_error" as const,
      externalId: `error:${row.id}`,
      url: row.source_url,
      title: `own error (${row.ts}): ${String(row.payload.source ?? row.payload.message ?? "unknown")}`,
      summary: JSON.stringify(row.payload),
      publishedAt: row.ts,
    }));
  } catch (err) {
    errors.push({ source: "own_errors", message: errorMessage(err) });
    return [];
  }
}
