import type { PublicEvent } from "../lib/types";
import { formatRelativeTime } from "../lib/derive";
import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

interface Props {
  latestEvent: PublicEvent | null;
  now: Date;
}

function describeEvent(e: PublicEvent): string {
  const payload = e.payload as Record<string, unknown>;
  switch (e.type) {
    case "session_start":
      return "waking up";
    case "session_end":
      return "session ended";
    case "item_seen":
      return `noticed ${String(payload.title ?? "something")}`;
    case "item_read":
      return `read ${String(payload.title ?? "something")}`;
    case "artifact":
      return "made something";
    case "post":
      return "posted";
    case "reply":
      return "replied";
    case "journal":
      return "wrote a journal entry";
    case "error":
      return `hit an error${payload.source ? ` (${String(payload.source)})` : ""}`;
    case "unprompted":
      return "did something unprompted";
    default:
      return "did something";
  }
}

export function Now({ latestEvent, now }: Props) {
  const text = latestEvent ? describeEvent(latestEvent) : "nothing has happened yet.";
  const slot = useTypewriterSlot("now", 0, 1);

  return (
    <section>
      <div className="section-label">
        <span>now</span>
      </div>
      {latestEvent ? (
        <div>
          <TypewriterText key={text} text={text} {...slot} />{" "}
          <span className="muted">— {formatRelativeTime(latestEvent.ts, now)}</span>
        </div>
      ) : (
        <div className="empty-state">
          <TypewriterText key={text} text={text} {...slot} />
        </div>
      )}
    </section>
  );
}
