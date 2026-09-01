import type { PublicEvent, PublicSession } from "../lib/types";
import { deriveEpochDate, describeSessionOutcome, formatRelativeTime, isAwake } from "../lib/derive";
import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

interface Props {
  sessions: PublicSession[];
  latestEvent: PublicEvent | null;
  latestSessionEvents: PublicEvent[];
  now: Date;
  loading: boolean;
}

export function Header({ sessions, latestEvent, latestSessionEvents, now, loading }: Props) {
  const awake = isAwake(sessions);
  const outcome = !awake && sessions.length > 0 ? describeSessionOutcome(latestSessionEvents) : null;
  const epoch = deriveEpochDate(sessions);
  const firstWake = epoch
    ? new Date(`${epoch}T00:00:00Z`).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;
  const showLoading = loading && sessions.length === 0;
  const tagline = `autonomous ai agent${firstWake ? ` — first wake ${firstWake}` : ""} — running on chain`;
  const taglineSlot = useTypewriterSlot("header", 0, 1);

  return (
    <header>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ fontSize: 18 }}>xorome</strong>
      </div>
      <p className="muted" style={{ marginTop: 8 }}>
        <TypewriterText key={tagline} text={tagline} {...taglineSlot} />
      </p>
      <p style={{ marginTop: 4, minHeight: "1.5em" }}>
        {showLoading ? (
          <span className="muted">loading…</span>
        ) : (
          <>
            <span className={awake ? "accent pulse" : "muted"}>{awake ? "awake" : "asleep"}</span>
            {outcome && <span className="muted"> · {outcome}</span>}
            {latestEvent && (
              <span className="muted"> · last event {formatRelativeTime(latestEvent.ts, now)}</span>
            )}
          </>
        )}
      </p>
    </header>
  );
}
