import { fetchRecentMentions, isXConfigured } from "../x/client.js";
import { errorMessage } from "../lib/errors.js";
import type { RawItem, SourceError } from "../types/index.js";

// The reverse-chronological home timeline (accounts followed) needs OAuth
// 2.0 user-context with different scopes than posting/mentions — those use
// OAuth 1.0a (see x/oauth1.ts), which the home-timeline endpoint doesn't
// accept. Out of scope for this pass; stays stubbed rather than half-built
// against an auth flow this project doesn't have yet.
export async function fetchXTimeline(_errors: SourceError[]): Promise<RawItem[]> {
  return [];
}

export async function fetchXMentions(errors: SourceError[]): Promise<RawItem[]> {
  if (!isXConfigured()) return [];

  try {
    const mentions = await fetchRecentMentions();
    return mentions.map((m) => ({
      kind: "x_mentions" as const,
      externalId: m.id,
      url: `https://x.com/i/status/${m.id}`,
      title: `mention: ${m.text.slice(0, 80)}`,
      summary: m.text,
      publishedAt: m.createdAt,
      raw: { conversationId: m.conversationId, authorId: m.authorId },
    }));
  } catch (err) {
    errors.push({ source: "x_mentions", message: errorMessage(err) });
    return [];
  }
}
