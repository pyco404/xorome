import { fetchText } from "../lib/http.js";
import { parseFeed } from "../lib/feed.js";
import { errorMessage } from "../lib/errors.js";
import { getConfig } from "../config/index.js";
import type { RawItem, SourceError } from "../types/index.js";

const ENTRIES_PER_FEED = 1;

export async function fetchRss(errors: SourceError[]): Promise<RawItem[]> {
  const feeds = getConfig().rssFeeds;
  const items: RawItem[] = [];

  for (const feedUrl of feeds) {
    try {
      const xml = await fetchText(feedUrl);
      const entries = parseFeed(xml, ENTRIES_PER_FEED);
      for (const entry of entries) {
        if (!entry.link) continue;
        items.push({
          kind: "rss" as const,
          externalId: entry.guid || entry.link,
          url: entry.link,
          title: entry.title,
          summary: entry.summary,
          publishedAt: entry.publishedAt,
          raw: { feedUrl },
        });
      }
    } catch (err) {
      errors.push({ source: "rss", message: `${feedUrl}: ${errorMessage(err)}`, url: feedUrl });
    }
  }

  return items;
}
