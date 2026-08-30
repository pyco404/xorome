import { getSupabase } from "../supabase/client.js";
import { currentGeneration } from "./generation.js";
import type { Session, SessionStatus } from "../types/index.js";

export async function startSession(): Promise<Session> {
  const supabase = getSupabase();
  const generation = await currentGeneration();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ status: "running", generation })
    .select()
    .single();
  if (error) throw error;
  return data as Session;
}

export async function endSession(
  sessionId: string,
  status: SessionStatus,
  opts: { notes?: string; budgetUsdSpent?: number } = {}
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("sessions")
    .update({
      status,
      ended_at: new Date().toISOString(),
      ...(opts.notes !== undefined ? { notes: opts.notes } : {}),
      ...(opts.budgetUsdSpent !== undefined ? { budget_usd_spent: opts.budgetUsdSpent } : {}),
    })
    .eq("id", sessionId);
  if (error) throw error;
}
