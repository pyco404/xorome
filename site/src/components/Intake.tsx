import type { PublicEvent, PublicSession } from "../lib/types";
import { latestSession } from "../lib/derive";

interface Props {
  sessions: PublicSession[];
  events: PublicEvent[]; // events belonging to the latest session only
}

interface ItemPayload {
  kind?: string;
  title?: string;
}

function payloadKind(e: PublicEvent): string {
  return String((e.payload as ItemPayload).kind ?? "unknown");
}

function payloadTitle(e: PublicEvent): string {
  return String((e.payload as ItemPayload).title ?? e.source_url ?? "untitled");
}

export function Intake({ sessions, events }: Props) {
  const latest = latestSession(sessions);
  const seen = events.filter((e) => e.type === "item_seen");
  const read = events.filter((e) => e.type === "item_read");

  const byKind = new Map<string, { seen: number; read: number }>();
  for (const e of seen) {
    const kind = payloadKind(e);
    const entry = byKind.get(kind) ?? { seen: 0, read: 0 };
    entry.seen += 1;
    byKind.set(kind, entry);
  }
  for (const e of read) {
    const kind = payloadKind(e);
    const entry = byKind.get(kind) ?? { seen: 0, read: 0 };
    entry.read += 1;
    byKind.set(kind, entry);
  }

  const readTitles = read.map(payloadTitle);
  const discarded = Math.max(0, seen.length - read.length);
  const hasData = Boolean(latest) && seen.length > 0;

  return (
    <section>
      <div className="section-label">
        <span>intake</span>
        <span>{hasData ? `${seen.length} seen · ${read.length} kept` : ""}</span>
      </div>

      {!hasData ? (
        <div className="empty-state">nothing read yet.</div>
      ) : (
        <>
          <div>
            {[...byKind.entries()].map(([kind, counts]) => (
              <div key={kind} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span className="source-label" style={{ width: 100, flexShrink: 0 }}>
                  {kind}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4 }}>
                  {Array.from({ length: Math.max(0, counts.seen - counts.read) }).map((_, i) => (
                    <span key={`s-${kind}-${i}`} className="dot dot--seen" />
                  ))}
                  {Array.from({ length: counts.read }).map((_, i) => (
                    <span key={`r-${kind}-${i}`} className="dot dot--read" />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {readTitles.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {readTitles.map((title, i) => (
                <div key={i} className="read-title">
                  {title}
                </div>
              ))}
            </div>
          )}

          <div className="discarded-line" style={{ marginTop: 10 }}>
            {discarded} item{discarded === 1 ? "" : "s"} seen and discarded
          </div>
        </>
      )}
    </section>
  );
}
