import { fetchJson, fetchText } from "../lib/http.js";
import { htmlToText } from "../lib/html.js";
import { errorMessage } from "../lib/errors.js";
import { fetchGithubReadme } from "../sources/github.js";
import type { RawItem } from "../types/index.js";

export interface ReadResult {
  item: RawItem;
  fullText: string;
  fetchMethod: string;
  error?: string;
}

interface WikiExtractResponse {
  query: { pages: Record<string, { extract?: string }> };
}

// The REST summary endpoint used at seen-time gives ~150-300 chars — almost
// never enough to clear a "read" length bar. This pulls the full plaintext
// extract instead.
async function fetchWikipediaExtract(title: string): Promise<string> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&titles=${encodeURIComponent(
    title
  )}`;
  const res = await fetchJson<WikiExtractResponse>(url);
  const page = Object.values(res.query.pages)[0];
  return (page?.extract ?? "").slice(0, 6000);
}

// Most item kinds already carry their full content from the seen-time
// fetch (arxiv abstract, RSS entry body, issue/release body, HN comment
// text). Three kinds need a second network call: a trending repo's README,
// an HN story's linked article, and a wildcard's full Wikipedia extract.
export async function readItemFully(item: RawItem): Promise<ReadResult> {
  switch (item.kind) {
    case "wildcard": {
      try {
        const extract = await fetchWikipediaExtract(item.title);
        return { item, fullText: extract || item.summary, fetchMethod: "wiki_extract" };
      } catch (err) {
        return {
          item,
          fullText: item.summary,
          fetchMethod: "wiki_extract_failed",
          error: errorMessage(err),
        };
      }
    }

    case "github_trending": {
      try {
        const readme = await fetchGithubReadme(item.externalId);
        return { item, fullText: readme, fetchMethod: "readme" };
      } catch (err) {
        return {
          item,
          fullText: item.summary,
          fetchMethod: "readme_failed",
          error: errorMessage(err),
        };
      }
    }

    case "hn_story": {
      if (!item.url || item.url.includes("news.ycombinator.com")) {
        return { item, fullText: item.summary, fetchMethod: "inline" };
      }
      try {
        const html = await fetchText(item.url);
        return { item, fullText: htmlToText(html), fetchMethod: "scrape" };
      } catch (err) {
        return {
          item,
          fullText: item.summary,
          fetchMethod: "scrape_failed",
          error: errorMessage(err),
        };
      }
    }

    default:
      return { item, fullText: item.summary, fetchMethod: "inline" };
  }
}
