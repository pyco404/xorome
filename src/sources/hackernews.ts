import { fetchJson } from "../lib/http.js";
import { errorMessage } from "../lib/errors.js";
import { getConfig } from "../config/index.js";
import type { RawItem, SourceError } from "../types/index.js";

const FIREBASE_BASE = "https://hacker-news.firebaseio.com/v0";
const FRONT_PAGE_LIMIT = 5;
const AGENT_COMMENTS_LIMIT = 3;

interface HnItem {
  id: number;
  title?: string;
  text?: string;
  url?: string;
  time: number;
  type: string;
}

interface AlgoliaHit {
  objectID: string;
  comment_text?: string;
  story_title?: string;
  story_url?: string;
  created_at: string;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

export async function fetchHackerNewsFrontPage(errors: SourceError[]): Promise<RawItem[]> {
  try {
    const ids = await fetchJson<number[]>(`${FIREBASE_BASE}/topstories.json`);
    const top = ids.slice(0, FRONT_PAGE_LIMIT);
    const stories = await Promise.all(
      top.map((id) => fetchJson<HnItem>(`${FIREBASE_BASE}/item/${id}.json`))
    );
    return stories
      .filter((s) => s && s.title)
      .map((s) => ({
        kind: "hn_story" as const,
        externalId: `hn:${s.id}`,
        url: s.url ?? `https://news.ycombinator.com/item?id=${s.id}`,
        title: s.title ?? "",
        summary: s.text ?? "",
        publishedAt: new Date(s.time * 1000).toISOString(),
        raw: { hnId: s.id, hasExternalUrl: Boolean(s.url) },
      }));
  } catch (err) {
    errors.push({
      source: "hackernews_frontpage",
      message: errorMessage(err),
      url: `${FIREBASE_BASE}/topstories.json`,
    });
    return [];
  }
}

export async function fetchHackerNewsAgentComments(errors: SourceError[]): Promise<RawItem[]> {
  const base = getConfig().hnAlgoliaBaseUrl;
  const url = `${base}/search?tags=comment&query=agent&numericFilters=created_at_i>${Math.floor(
    (Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000
  )}&hitsPerPage=${AGENT_COMMENTS_LIMIT}`;

  try {
    const res = await fetchJson<AlgoliaResponse>(url);
    return res.hits
      .filter((h) => h.comment_text)
      .map((h) => ({
        kind: "hn_comment" as const,
        externalId: `hn_comment:${h.objectID}`,
        url: `https://news.ycombinator.com/item?id=${h.objectID}`,
        title: h.story_title ? `re: ${h.story_title}` : "hn comment",
        summary: (h.comment_text ?? "").slice(0, 4000),
        publishedAt: h.created_at,
        raw: { storyUrl: h.story_url },
      }));
  } catch (err) {
    errors.push({ source: "hackernews_comments", message: errorMessage(err), url });
    return [];
  }
}
