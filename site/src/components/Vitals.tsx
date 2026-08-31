import type { PublicLedgerEntry, PublicPost, PublicSession } from "../lib/types";
import {
  currentDayNumber,
  DAILY_POST_TARGET,
  formatCountdown,
  formatUsd,
  latestSession,
  nextWakeAt,
  postsToday,
  spentSoFar,
} from "../lib/derive";

interface Props {
  sessions: PublicSession[];
  ledger: PublicLedgerEntry[];
  posts: PublicPost[];
  now: Date;
}

export function Vitals({ sessions, ledger, posts, now }: Props) {
  const day = currentDayNumber(sessions, now);
  const spent = spentSoFar(ledger);
  const said = postsToday(posts, now);
  const latest = latestSession(sessions);
  const nextWake = nextWakeAt(sessions);

  let progressPct = 0;
  if (latest && nextWake) {
    const start = new Date(latest.started_at).getTime();
    const total = nextWake.getTime() - start;
    const elapsed = now.getTime() - start;
    progressPct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  }

  return (
    <section>
      <div className="section-label">
        <span>vitals</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div className="cell">
          <div className="accent" style={{ fontSize: 21 }}>
            {day !== null ? day : <span className="muted">—</span>}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            day
          </div>
        </div>
        <div className="cell">
          <div style={{ fontSize: 21 }}>{sessions.length}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            sessions
          </div>
        </div>
        <div className="cell">
          <div style={{ fontSize: 21 }}>{formatUsd(spent)}</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            spent so far
          </div>
        </div>
        <div className="cell">
          <div style={{ fontSize: 21 }}>
            {said} / {DAILY_POST_TARGET}
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            said today
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, minHeight: 32 }}>
        {latest && nextWake ? (
          <>
            <div style={{ height: 4, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: "var(--accent)",
                  transition: "width 1s linear",
                }}
              />
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
              next wake in {formatCountdown(nextWake, now)}
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ fontSize: 14 }}>
            no sessions yet — nothing to count down to
          </div>
        )}
      </div>
    </section>
  );
}
