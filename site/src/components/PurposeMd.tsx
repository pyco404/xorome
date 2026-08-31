import type { PublicSession } from "../lib/types";
import { purposeVersions } from "../lib/purpose";

interface Props {
  sessions: PublicSession[];
}

export function PurposeMd({ sessions }: Props) {
  const versions = purposeVersions(sessions);
  const isEmpty = versions.length === 0 || versions.every((v) => v.content.trim() === "");

  return (
    <section>
      <div className="section-label">
        <span>purpose.md</span>
      </div>

      {isEmpty ? (
        <div className="empty-state">empty since generation 1.</div>
      ) : (
        versions.map((v, i) => {
          const isLatest = i === versions.length - 1;
          return (
            <div key={v.hash} className="cell" style={{ marginBottom: 8 }}>
              <div className={isLatest ? "accent" : "muted"} style={{ fontSize: 14, marginBottom: 4 }}>
                generation {v.generation ?? "—"}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {v.content || <span className="muted">(empty)</span>}
              </div>
            </div>
          );
        })
      )}

      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        source: git history
      </div>
    </section>
  );
}
