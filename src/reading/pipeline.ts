import { getConfig } from "../config/index.js";
import { logEvent } from "../events/log.js";
import { filterUnseen } from "./dedupe.js";
import { selectItemsToRead } from "./select.js";
import { readItemFully } from "./fullText.js";
import { fetchArxiv } from "../sources/arxiv.js";
import { fetchGithubTrending, fetchGithubReleases, fetchGithubIssues } from "../sources/github.js";
import { fetchHackerNewsFrontPage, fetchHackerNewsAgentComments } from "../sources/hackernews.js";
import { fetchRss } from "../sources/rss.js";
import { fetchOwnHistory } from "../sources/ownHistory.js";
import { fetchOwnErrors } from "../sources/ownErrors.js";
import { fetchWildcard } from "../sources/wildcard.js";
import { fetchXTimeline, fetchXMentions } from "../sources/xTimeline.js";
import type { RawItem, SourceError } from "../types/index.js";

const MAX_ITEMS_SEEN = 40;

export interface ReadItem {
  item: RawItem;
  fullText: string;
  fetchMethod: string;
}

export interface ReadingPipelineResult {
  totalFetched: number;
  itemsSeen: RawItem[];
  itemsRead: ReadItem[];
  sourceErrors: SourceError[];
}

// Fetches all sources, dedupes against past item_seen events, logs
// item_seen for everything new (capped at MAX_ITEMS_SEEN), then reads a
// small diverse sample in full and logs item_read for those. No posting —
// that's step 3.
export async function runReadingPipeline(
  sessionId: string,
  generation: number
): Promise<ReadingPipelineResult> {
  const errors: SourceError[] = [];

  const results = await Promise.all([
    fetchArxiv(errors),
    fetchGithubTrending(errors),
    fetchGithubReleases(errors),
    fetchGithubIssues(errors),
    fetchHackerNewsFrontPage(errors),
    fetchHackerNewsAgentComments(errors),
    fetchRss(errors),
    fetchOwnHistory(errors, sessionId),
    fetchOwnErrors(errors),
    fetchWildcard(errors),
    fetchXTimeline(errors),
    fetchXMentions(errors),
  ]);

  const allItems = results.flat();
  const totalFetched = allItems.length;

  const unseen = await filterUnseen(allItems);
  const capped = unseen.slice(0, MAX_ITEMS_SEEN);

  for (const item of capped) {
    await logEvent(
      sessionId,
      generation,
      "item_seen",
      {
        kind: item.kind,
        externalId: item.externalId,
        title: item.title,
        summary: item.summary.slice(0, 500),
        publishedAt: item.publishedAt,
      },
      item.url ?? undefined
    );
  }

  for (const err of errors) {
    await logEvent(sessionId, generation, "error", { ...err, stage: "read" }, err.url);
  }

  const toRead = selectItemsToRead(capped, getConfig().maxItemsReadPerSession);
  const itemsRead: ReadItem[] = [];

  for (const item of toRead) {
    const result = await readItemFully(item);
    itemsRead.push({ item: result.item, fullText: result.fullText, fetchMethod: result.fetchMethod });

    await logEvent(
      sessionId,
      generation,
      "item_read",
      {
        kind: item.kind,
        externalId: item.externalId,
        title: item.title,
        fullText: result.fullText.slice(0, 6000),
        fetchMethod: result.fetchMethod,
      },
      item.url ?? undefined
    );

    if (result.error) {
      await logEvent(
        sessionId,
        generation,
        "error",
        {
          source: "read_full_text",
          kind: item.kind,
          externalId: item.externalId,
          message: result.error,
        },
        item.url ?? undefined
      );
    }
  }

  return { totalFetched, itemsSeen: capped, itemsRead, sourceErrors: errors };
}
