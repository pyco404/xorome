import { getSupabase } from "../supabase/client.js";
import type { EventType } from "../types/index.js";

export async function logEvent(
  sessionId: string,
  generation: number,
  type: EventType,
  payload: Record<string, unknown> = {},
  sourceUrl?: string | null
): Promise<string> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("events")
    .insert({
      session_id: sessionId,
      generation,
      type,
      payload,
      source_url: sourceUrl ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}
