import { getSupabase } from "../supabase/client.js";
import type { LedgerCategory } from "../types/index.js";

export async function logLedgerEntry(
  sessionId: string | null,
  amountUsd: number,
  category: LedgerCategory,
  description: string,
  txSignature: string | null = null
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ledger")
    .insert({
      session_id: sessionId,
      amount_usd: amountUsd,
      category,
      description,
      tx_signature: txSignature,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

// One `api` row per session, every session — including when spend is
// genuinely zero, which it always is right now: nothing in the reading
// pipeline calls the Agent SDK. Once step 3 adds real Agent SDK calls,
// pass the real total_cost_usd from its SDKResultMessage here instead of 0.
export async function logSessionApiSpend(
  sessionId: string,
  totalCostUsd: number,
  description: string
): Promise<string> {
  return logLedgerEntry(sessionId, -Math.abs(totalCostUsd), "api", description);
}
