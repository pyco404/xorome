import type { PublicEvent, PublicPost } from "../lib/types";
import { formatRelativeTime } from "../lib/derive";
import { useTypewriterSlot } from "../hooks/useTypewriter";
import { TypewriterText } from "./TypewriterText";

interface Props {
  posts: PublicPost[];
  sourceEvents: Map<string, PublicEvent>;
  now: Date;
}

const EMPTY_TEXT = "nothing said yet — post generation isn't built.";

function sourceFor(post: PublicPost, sourceEvents: Map<string, PublicEvent>): string | null {
  for (const id of post.event_ids) {
    const event = sourceEvents.get(id);
    if (event?.source_url) return event.source_url;
  }
  return null;
}

// Its own component so useTypewriterSlot (a hook) is called once per
// instance, not inside the parent's .map() callback — hooks can't be
// called a variable number of times per render.
function SaidPost({
  post,
  index,
  itemCount,
  sourceEvents,
  now,
}: {
  post: PublicPost;
  index: number;
  itemCount: number;
  sourceEvents: Map<string, PublicEvent>;
  now: Date;
}) {
  const slot = useTypewriterSlot("said", index, itemCount);
  const source = sourceFor(post, sourceEvents);

  return (
    <div className="cell" style={{ marginBottom: 8 }}>
      <div className="muted" style={{ fontSize: 14, marginBottom: 4 }}>
        {post.category} · {formatRelativeTime(post.ts, now)}
      </div>
      <div>
        <TypewriterText key={post.content} text={post.content} {...slot} />
      </div>
      {(source || post.x_post_id) && (
        <div style={{ marginTop: 6, fontSize: 14 }}>
          {source && (
            <a href={source} target="_blank" rel="noreferrer">
              source
            </a>
          )}
          {source && post.x_post_id && " · "}
          {post.x_post_id && (
            <a href={`https://x.com/xoromeai/status/${post.x_post_id}`} target="_blank" rel="noreferrer">
              on x
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SaidEmpty() {
  const slot = useTypewriterSlot("said", 0, 1);
  return (
    <div className="empty-state">
      <TypewriterText key={EMPTY_TEXT} text={EMPTY_TEXT} {...slot} />
    </div>
  );
}

export function Said({ posts, sourceEvents, now }: Props) {
  return (
    <section>
      <div className="section-label">
        <span>said</span>
      </div>

      {posts.length === 0 ? (
        <SaidEmpty />
      ) : (
        posts.map((p, i) => (
          <SaidPost key={i} post={p} index={i} itemCount={posts.length} sourceEvents={sourceEvents} now={now} />
        ))
      )}
    </section>
  );
}
