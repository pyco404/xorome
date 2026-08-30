import type { RawItem, SourceKind } from "../types/index.js";

// arXiv weighted highest per explicit ask: highest-signal source, was being
// read 0 times across the first two sessions despite being ~1/3 of the pool.
const KIND_WEIGHTS: Partial<Record<SourceKind, number>> = {
  arxiv: 5,
  github_issue: 2,
  rss: 2,
  wildcard: 2,
  hn_story: 1.5,
  hn_comment: 1.5,
  own_error: 1.5,
  github_release: 1,
  github_trending: 1,
  own_history: 1,
  x_timeline: 1,
  x_mentions: 1,
};

export function weightFor(kind: SourceKind): number {
  return KIND_WEIGHTS[kind] ?? 1;
}

// Two items count as the same entity if they're about the same repo (a
// release and an issue from the same repo shouldn't both get read), or
// otherwise the same kind+externalId.
export function entityKey(item: RawItem): string {
  switch (item.kind) {
    case "github_trending":
      return `repo:${item.externalId}`;
    case "github_release":
    case "github_issue": {
      const repo = typeof item.raw?.repo === "string" ? item.raw.repo : item.externalId.split("#")[0];
      return `repo:${repo}`;
    }
    default:
      return `${item.kind}:${item.externalId}`;
  }
}

// Weighted random pick, no replacement. Caller is responsible for removing
// the returned item from `pool` before the next call.
export function pickWeighted(pool: RawItem[]): RawItem | null {
  if (pool.length === 0) return null;
  const weights = pool.map((item) => weightFor(item.kind));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i] ?? 0;
    if (r <= 0) return pool[i] ?? null;
  }
  return pool[pool.length - 1] ?? null;
}
