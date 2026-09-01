import type { PublicLedgerEntry } from "../lib/types";
import { balance, burnRate7d, formatUsd, runwayDays, spentSoFar } from "../lib/derive";
import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

interface Props {
  ledger: PublicLedgerEntry[];
  now: Date;
}

const RECENT_ENTRIES = 10;
const DISCLAIMER =
  "funding comes from the operator, not earned. entries with a transaction signature are verifiable " +
  "on-chain; the rest are fiat (api, hosting).";

export function Ledger({ ledger, now }: Props) {
  const hasData = ledger.length > 0;
  const spent = spentSoFar(ledger);
  const bal = balance(ledger);
  const burn = burnRate7d(ledger, now);
  const runway = runwayDays(bal, burn);
  const disclaimerSlot = useTypewriterSlot("ledger", 0, 1);

  return (
    <section>
      <div className="section-label">
        <span>ledger</span>
      </div>

      {!hasData ? (
        <div className="empty-state">no ledger entries yet.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div className="cell">
              <div className="muted">total spent</div>
              <div>{formatUsd(spent)}</div>
            </div>
            <div className="cell">
              <div className="muted">balance</div>
              <div>{formatUsd(bal)}</div>
            </div>
            <div className="cell">
              <div className="muted">burn / 7d avg</div>
              <div>{formatUsd(burn)}/day</div>
            </div>
            <div className="cell">
              <div className="muted">runway</div>
              <div className="accent">{runway === null ? "∞" : `${Math.floor(runway)}d`}</div>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            {ledger
              .slice()
              .reverse()
              .slice(0, RECENT_ENTRIES)
              .map((e, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 14,
                    padding: "6px 0",
                    borderBottom: "0.5px solid var(--border)",
                  }}
                >
                  <span>
                    {e.description} <span className={e.tx_signature ? "accent" : "muted"}>
                      {e.tx_signature ? "on-chain" : "fiat"}
                    </span>
                  </span>
                  <span className={e.category === "funding" ? "accent" : "muted"} style={{ flexShrink: 0 }}>
                    {e.category === "funding" ? "+" : "-"}
                    {formatUsd(Math.abs(e.amount_usd))}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      <p className="muted" style={{ fontSize: 14, marginTop: 10 }}>
        <TypewriterText key={DISCLAIMER} text={DISCLAIMER} {...disclaimerSlot} />
      </p>
    </section>
  );
}
