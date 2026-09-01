import { getSupabase } from "../supabase/client.js";

export interface GeneratedArtifact {
  content: string;
  title: string;
}

const LOOKBACK_DAYS = 3;

// A plot of its own event data — an ASCII bar chart, no charting library,
// consistent with the project's lean dependencies. Pure computation over
// real rows, no LLM call, so it's always available even in a degraded
// session.
export async function makePlot(): Promise<GeneratedArtifact> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("events")
    .select("payload")
    .eq("type", "item_seen")
    .gte("ts", since);
  if (error) throw error;

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const kind = String((row.payload as Record<string, unknown>).kind ?? "unknown");
    counts[kind] = (counts[kind] ?? 0) + 1;
  }

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));
  const barWidth = 30;

  const lines =
    entries.length > 0
      ? entries.map(([kind, n]) => {
          const bar = "#".repeat(Math.max(1, Math.round((n / max) * barWidth)));
          return `${kind.padEnd(18)} ${bar} ${n}`;
        })
      : ["(no items seen in this window)"];

  const content = [
    "# items seen by source kind",
    "",
    `last ${LOOKBACK_DAYS} days, generated ${new Date().toISOString()}`,
    "",
    "```",
    ...lines,
    "```",
    "",
  ].join("\n");

  return { content, title: "items seen by source kind" };
}

// A short factual note computed from real stats — no LLM call, deliberately
// not generative filler.
export async function makeNote(): Promise<GeneratedArtifact> {
  const supabase = getSupabase();

  const { count: sessionCount } = await supabase
    .from("sessions")
    .select("*", { count: "exact", head: true });
  const { count: readCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("type", "item_read");
  const { count: seenCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("type", "item_seen");
  const { data: ledgerRows } = await supabase.from("ledger").select("amount_usd");

  const spent = (ledgerRows ?? [])
    .filter((r) => r.amount_usd < 0)
    .reduce((sum, r) => sum + Math.abs(r.amount_usd), 0);
  const clearRate = seenCount && seenCount > 0 ? (((readCount ?? 0) / seenCount) * 100).toFixed(1) : "0.0";

  const content = [
    "# reading stats",
    "",
    `generated ${new Date().toISOString()}`,
    "",
    `- sessions run: ${sessionCount ?? 0}`,
    `- items seen: ${seenCount ?? 0}`,
    `- items read (cleared the 400-char bar): ${readCount ?? 0}`,
    `- clear rate: ${clearRate}%`,
    `- total spent: $${spent.toFixed(4)}`,
    "",
  ].join("\n");

  return { content, title: "reading stats" };
}
