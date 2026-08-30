import { fetchText } from "../lib/http.js";
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

// Most item kinds already carry their full content from the seen-time
// fetch (arxiv abstract, RSS entry body, issue/release body, HN comment
// text). Only two kinds need a second network call: a trending repo's
// README, and an HN story's linked article.
export async function readItemFully(item: RawItem): Promise<ReadResult> {
  switch (item.kind) {
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
