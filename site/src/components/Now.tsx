import type { PublicEvent } from "../lib/types";
import { formatRelativeTime } from "../lib/derive";

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
  return (
    <section>
      <div className="section-label">
        <span>now</span>
      </div>
      {latestEvent ? (
        <div>
          {describeEvent(latestEvent)} <span className="muted">— {formatRelativeTime(latestEvent.ts, now)}</span>
        </div>
      ) : (
        <div className="empty-state">nothing has happened yet.</div>
      )}
    </section>
  );
}
