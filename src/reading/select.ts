import type { RawItem } from "../types/index.js";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

// Picks a source-diverse sample to read in full. This is a mechanical
// pick, not a judgment about what's interesting — that call belongs to
// the agent in post generation (step 3), not the harness.
export function selectItemsToRead(items: RawItem[], limit: number): RawItem[] {
  const byKind = new Map<string, RawItem[]>();
  for (const item of items) {
    const bucket = byKind.get(item.kind) ?? [];
    bucket.push(item);
    byKind.set(item.kind, bucket);
  }
  for (const [kind, bucket] of byKind) byKind.set(kind, shuffle(bucket));

  const kinds = shuffle([...byKind.keys()]);
  const selected: RawItem[] = [];
  let round = 0;
  while (selected.length < limit && kinds.some((k) => (byKind.get(k)?.length ?? 0) > round)) {
    for (const kind of kinds) {
      const bucket = byKind.get(kind);
      const candidate = bucket?.[round];
      if (!candidate) continue;
      selected.push(candidate);
      if (selected.length >= limit) break;
    }
    round++;
  }

  return selected;
}
