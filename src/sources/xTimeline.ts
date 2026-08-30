import type { RawItem, SourceError } from "../types/index.js";

// Stubs until step 4 wires up X API credentials. Return empty rather than
// throwing so the pipeline runs the same shape now as it will later.

export async function fetchXTimeline(_errors: SourceError[]): Promise<RawItem[]> {
  return [];
}

export async function fetchXMentions(_errors: SourceError[]): Promise<RawItem[]> {
  return [];
}
