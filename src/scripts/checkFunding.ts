import { getSupabase } from "../supabase/client.js";
import { logLedgerEntry } from "../events/ledger.js";

// Watches the treasury address for new incoming transfers and logs each as
// a real ledger entry — real signature, real on-chain amount, real block
// time. Idempotent by tx_signature, so re-running (every tick, forever)
// never double-counts. Ethereum isn't wired up here: the address is
// funded-but-empty right now, and finding its incoming transactions
// without a paid indexer (Etherscan API key, e.g.) needs scanning raw
// blocks — not worth building against an address with no real activity to
// verify the logic against. Add it the same way once it actually holds
// something.
const SOLANA_ADDRESS = "C2LJGNAGb2ZBD81rcHS7PtmFyuKWbJrJHxKyXHwUwZ7a";
const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const SIGNATURE_LOOKBACK = 50;

interface SolanaSignatureInfo {
  signature: string;
  blockTime: number | null;
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = (await res.json()) as { result?: T; error?: { message: string } };
  if (body.error) throw new Error(`solana rpc ${method} failed: ${body.error.message}`);
  return body.result as T;
}

async function fetchSolPriceUsd(): Promise<number> {
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
  const body = (await res.json()) as { solana: { usd: number } };
  return body.solana.usd;
}

async function alreadyLoggedSignatures(): Promise<Set<string>> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("ledger")
    .select("tx_signature")
    .eq("category", "funding")
    .not("tx_signature", "is", null);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.tx_signature as string));
}

async function checkSolanaFunding(): Promise<number> {
  const logged = await alreadyLoggedSignatures();
  const signatures = await solanaRpc<SolanaSignatureInfo[]>("getSignaturesForAddress", [
    SOLANA_ADDRESS,
    { limit: SIGNATURE_LOOKBACK },
  ]);
  const unseen = signatures.filter((s) => !logged.has(s.signature));
  if (unseen.length === 0) return 0;

  const price = await fetchSolPriceUsd();
  let loggedCount = 0;

  for (const sig of unseen) {
    const tx = await solanaRpc<{
      meta: { preBalances: number[]; postBalances: number[] };
      transaction: { message: { accountKeys: Array<{ pubkey: string } | string> } };
      blockTime: number | null;
    } | null>("getTransaction", [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    if (!tx) continue;

    const keys = tx.transaction.message.accountKeys;
    const idx = keys.findIndex((k) => (typeof k === "string" ? k : k.pubkey) === SOLANA_ADDRESS);
    if (idx === -1) continue;

    const deltaLamports = tx.meta.postBalances[idx]! - tx.meta.preBalances[idx]!;
    if (deltaLamports <= 0) continue; // outgoing or fee-only, not funding

    const deltaSol = deltaLamports / 1e9;
    const amountUsd = deltaSol * price;
    const entryId = await logLedgerEntry(
      null,
      amountUsd,
      "funding",
      `solana funding: ${deltaSol.toFixed(9)} SOL @ $${price}/SOL`,
      sig.signature
    );

    // Backdate to the real on-chain time, not "when this script happened
    // to run" — the ledger should reflect when the money actually moved.
    if (sig.blockTime) {
      const supabase = getSupabase();
      await supabase
        .from("ledger")
        .update({ ts: new Date(sig.blockTime * 1000).toISOString() })
        .eq("id", entryId);
    }

    loggedCount++;
  }

  return loggedCount;
}

async function main() {
  const count = await checkSolanaFunding();
  console.log(count > 0 ? `logged ${count} new funding entr${count === 1 ? "y" : "ies"}` : "no new funding");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
