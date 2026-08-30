import { fetchJson } from "../lib/http.js";
import { errorMessage } from "../lib/errors.js";
import type { RawItem, SourceError } from "../types/index.js";

interface WikiSummary {
  title: string;
  extract: string;
  content_urls: { desktop: { page: string } };
  timestamp: string;
}

const WIKI_URL = "https://en.wikipedia.org/api/rest_v1/page/random/summary";

// One wildcard per session: something from outside tech entirely.
export async function fetchWildcard(errors: SourceError[]): Promise<RawItem[]> {
  try {
    const page = await fetchJson<WikiSummary>(WIKI_URL);
    return [
      {
        kind: "wildcard" as const,
        externalId: `wikipedia:${page.title}`,
        url: page.content_urls.desktop.page,
        title: page.title,
        summary: page.extract,
        publishedAt: page.timestamp,
      },
    ];
  } catch (err) {
    errors.push({ source: "wildcard", message: errorMessage(err), url: WIKI_URL });
    return [];
  }
}
