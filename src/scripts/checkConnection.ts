import { getSupabase } from "../supabase/client.js";

const TABLES = ["sessions", "events", "posts", "ledger"] as const;

async function main() {
  const supabase = getSupabase();
  let ok = true;

  for (const table of TABLES) {
    const { error, count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      ok = false;
      console.error(`[fail] ${table}: ${error.message}`);
    } else {
      console.log(`[ok]   ${table} (${count ?? 0} rows)`);
    }
  }

  if (!ok) {
    console.error(
      "\none or more tables are missing. run supabase/migrations/0001_init.sql " +
        "in the Supabase SQL editor, then retry."
    );
    process.exit(1);
  }

  console.log("\nschema reachable.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
