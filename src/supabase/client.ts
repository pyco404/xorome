import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../config/index.js";
import type { Database } from "../types/database.js";

let client: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabase() {
  if (client) return client;

  const config = getConfig();
  client = createClient<Database>(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return client;
}
