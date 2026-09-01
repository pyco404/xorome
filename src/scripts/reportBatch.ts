import { getSupabase } from "../supabase/client.js";

// Reports on every `npm run session` run (distinguished from `npm run
// read`-only sessions by the "step 3:" notes prefix endSession writes),
// with the three outcomes the batch report needs distinguished: nothing
// read (no candidates possible), candidates generated but all vetoed, or
// a post actually produced.
async function main() {
  const supabase = getSupabase();
  const { data: sessions, error } = await supabase
    .from("sessions")
    .select("id, generation, started_at, notes")
    .like("notes", "step 3:%")
    .order("started_at", { ascending: true });
  if (error) throw error;

  let nothingToRead = 0;
  let vetoed = 0;
  let posted = 0;

  for (const session of sessions ?? []) {
    const { data: events } = await supabase
      .from("events")
      .select("type, payload")
      .eq("session_id", session.id);

    const rows = events ?? [];
    const itemReadCount = rows.filter((e) => e.type === "item_read").length;
    const candidates = rows.filter((e) => e.type === "post_candidate");
    const survived = candidates.filter((e) => (e.payload as Record<string, unknown>).mechanical_pass).length;
    const postEvent = rows.find((e) => e.type === "post");

    let outcome: string;
    if (itemReadCount === 0) {
      outcome = "nothing read";
      nothingToRead++;
    } else if (!postEvent) {
      outcome = "vetoed";
      vetoed++;
    } else {
      outcome = "posted";
      posted++;
    }

    const category =
      (postEvent?.payload as Record<string, unknown> | undefined)?.category ??
      (candidates[0]?.payload as Record<string, unknown> | undefined)?.category ??
      "n/a";

    const { data: ledgerRows } = await supabase
      .from("ledger")
      .select("amount_usd")
      .eq("session_id", session.id);
    const cost = (ledgerRows ?? []).reduce((sum, r) => sum + Math.abs(Math.min(0, r.amount_usd)), 0);

    console.log(
      `gen ${session.generation} (${session.started_at}) — category: ${category}, ` +
        `candidates: ${candidates.length}, survived mechanical: ${survived}, ` +
        `outcome: ${outcome}, cost: $${cost.toFixed(4)}`
    );
  }

  const total = sessions?.length ?? 0;
  console.log(
    `\n${total} run(s) — nothing read: ${nothingToRead}, vetoed: ${vetoed}, posted: ${posted}`
  );
}

main();
