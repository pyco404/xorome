import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Publishable/anon key only. This client only ever reaches the public_*
// views — the base tables reject it (RLS, no policies). See
// supabase/migrations/0004_public_views.sql.
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
});
