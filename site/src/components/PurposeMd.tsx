import type { PublicSession } from "../lib/types";
import { purposeVersions, type PurposeVersion } from "../lib/purpose";
import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

interface Props {
  sessions: PublicSession[];
}

const EMPTY_TEXT = "empty since generation 1.";

// Its own component so useTypewriterSlot is called once per instance, not
// inside the parent's .map() callback.
function PurposeVersionItem({ version, index, itemCount, isLatest }: {
  version: PurposeVersion;
  index: number;
  itemCount: number;
  isLatest: boolean;
}) {
  const slot = useTypewriterSlot("purpose", index, itemCount);
  const text = version.content || "(empty)";

  return (
    <div className="cell" style={{ marginBottom: 8 }}>
      <div className={isLatest ? "accent" : "muted"} style={{ fontSize: 14, marginBottom: 4 }}>
        generation {version.generation ?? "—"}
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>
        <TypewriterText key={text} text={text} {...slot} />
      </div>
    </div>
  );
}

function PurposeEmpty() {
  const slot = useTypewriterSlot("purpose", 0, 1);
  return (
    <div className="empty-state">
      <TypewriterText key={EMPTY_TEXT} text={EMPTY_TEXT} {...slot} />
    </div>
  );
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
        <PurposeEmpty />
      ) : (
        versions.map((v, i) => (
          <PurposeVersionItem
            key={v.hash}
            version={v}
            index={i}
            itemCount={versions.length}
            isLatest={i === versions.length - 1}
          />
        ))
      )}

      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
        source: git history
      </div>
    </section>
  );
}
