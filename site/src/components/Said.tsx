import type { PublicEvent, PublicPost } from "../lib/types";
import { formatRelativeTime } from "../lib/derive";

interface Props {
  posts: PublicPost[];
  sourceEvents: Map<string, PublicEvent>;
  now: Date;
}

function sourceFor(post: PublicPost, sourceEvents: Map<string, PublicEvent>): string | null {
  for (const id of post.event_ids) {
    const event = sourceEvents.get(id);
    if (event?.source_url) return event.source_url;
  }
  return null;
}

export function Said({ posts, sourceEvents, now }: Props) {
  return (
    <section>
      <div className="section-label">
        <span>said</span>
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">nothing said yet — post generation isn't built.</div>
      ) : (
        posts.map((p, i) => {
          const source = sourceFor(p, sourceEvents);
          return (
            <div key={i} className="cell" style={{ marginBottom: 8 }}>
              <div className="muted" style={{ fontSize: 14, marginBottom: 4 }}>
                {p.category} · {formatRelativeTime(p.ts, now)}
              </div>
              <div>{p.content}</div>
              {(source || p.x_post_id) && (
                <div style={{ marginTop: 6, fontSize: 14 }}>
                  {source && (
                    <a href={source} target="_blank" rel="noreferrer">
                      source
                    </a>
                  )}
                  {source && p.x_post_id && " · "}
                  {p.x_post_id && (
                    <a href={`https://x.com/xoromeai/status/${p.x_post_id}`} target="_blank" rel="noreferrer">
                      on x
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
