import { getSupabase } from "../supabase/client.js";

const EPOCH_KEY = "epoch_date";
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The date generation 1 started. Set once, on the very first session ever;
// read on every session after that. Stored explicitly rather than derived
// from MIN(sessions.started_at) so it can't silently shift if early rows
// are ever pruned.
async function getOrCreateEpochDate(): Promise<string> {
  const supabase = getSupabase();

  const { data: existing, error: readError } = await supabase
    .from("agent_meta")
    .select("value")
    .eq("key", EPOCH_KEY)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return existing.value;

  const today = utcDateString(new Date());
  const { error: insertError } = await supabase
    .from("agent_meta")
    .insert({ key: EPOCH_KEY, value: today });

  if (insertError) {
    // Lost a race with another session starting at the same instant —
    // whoever won, re-read and use their value.
    const { data: retry, error: retryError } = await supabase
      .from("agent_meta")
      .select("value")
      .eq("key", EPOCH_KEY)
      .single();
    if (retryError) throw retryError;
    return retry.value;
  }

  return today;
}

export function generationForDate(dateIso: string, epochIso: string): number {
  const date = Date.parse(`${dateIso}T00:00:00Z`);
  const epoch = Date.parse(`${epochIso}T00:00:00Z`);
  return Math.floor((date - epoch) / DAY_MS) + 1;
}

export async function currentGeneration(): Promise<number> {
  const epoch = await getOrCreateEpochDate();
  return generationForDate(utcDateString(new Date()), epoch);
}
