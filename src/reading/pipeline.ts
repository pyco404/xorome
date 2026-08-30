import { getConfig } from "../config/index.js";
import { logEvent } from "../events/log.js";
import { filterUnseen } from "./dedupe.js";
import { entityKey, pickWeighted, weightFor } from "./select.js";
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
const MIN_READ_CHARS = 400;
const MAX_READ_ATTEMPTS = 15;
const WILDCARD_SESSION_PROBABILITY = 0.25;

export interface ReadItem {
  item: RawItem;
  fullText: string;
  fetchMethod: string;
  selectionReason: string;
  chars: number;
}

export interface SkippedAttempt {
  item: RawItem;
  chars: number;
  reason: string;
}

export interface ReadingPipelineResult {
  totalFetched: number;
  itemsSeen: RawItem[];
  itemsRead: ReadItem[];
  skippedAttempts: SkippedAttempt[];
  wildcardEligible: boolean;
  sourceErrors: SourceError[];
}

// Fetches all sources, dedupes against past item_seen events, logs
// item_seen for everything new (capped at MAX_ITEMS_SEEN), then reads a
// small sample in full and logs item_read for those. No posting — that's
// step 3.
//
// Selection is weighted random (arxiv weighted highest — see select.ts),
// excludes wildcard from the candidate pool in ~3 of 4 sessions, and won't
// pick two items about the same repo/entity in one session. An attempt only
// counts as a read if it clears MIN_READ_CHARS of extractable text; short
// attempts (e.g. a release with an empty body) are logged as item_seen
// only, and the loop tries the next weighted candidate instead.
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

  const wildcardEligible = Math.random() < WILDCARD_SESSION_PROBABILITY;
  let pool = capped.filter((item) => item.kind !== "wildcard" || wildcardEligible);

  const usedEntities = new Set<string>();
  const itemsRead: ReadItem[] = [];
  const skippedAttempts: SkippedAttempt[] = [];
  let attempts = 0;
  const limit = getConfig().maxItemsReadPerSession;

  while (itemsRead.length < limit && pool.length > 0 && attempts < MAX_READ_ATTEMPTS) {
    const eligible = pool.filter((item) => !usedEntities.has(entityKey(item)));
    if (eligible.length === 0) break;

    const picked = pickWeighted(eligible);
    if (!picked) break;
    attempts++;
    pool = pool.filter((item) => item !== picked);

    const result = await readItemFully(picked);
    const chars = result.fullText.trim().length;

    if (chars < MIN_READ_CHARS) {
      skippedAttempts.push({ item: picked, chars, reason: "below_min_read_chars" });
      if (result.error) {
        await logEvent(
          sessionId,
          generation,
          "error",
          {
            source: "read_full_text",
            kind: picked.kind,
            externalId: picked.externalId,
            message: result.error,
          },
          picked.url ?? undefined
        );
      }
      continue;
    }

    usedEntities.add(entityKey(picked));
    const selectionReason = `weighted pick (kind=${picked.kind}, weight=${weightFor(
      picked.kind
    )}), attempt ${attempts} of ${MAX_READ_ATTEMPTS}, ${chars} chars via ${result.fetchMethod}`;

    itemsRead.push({
      item: picked,
      fullText: result.fullText,
      fetchMethod: result.fetchMethod,
      selectionReason,
      chars,
    });

    await logEvent(
      sessionId,
      generation,
      "item_read",
      {
        kind: picked.kind,
        externalId: picked.externalId,
        title: picked.title,
        fullText: result.fullText.slice(0, 6000),
        fetchMethod: result.fetchMethod,
        selection_reason: selectionReason,
        chars,
      },
      picked.url ?? undefined
    );

    if (result.error) {
      await logEvent(
        sessionId,
        generation,
        "error",
        {
          source: "read_full_text",
          kind: picked.kind,
          externalId: picked.externalId,
          message: result.error,
        },
        picked.url ?? undefined
      );
    }
  }

  return {
    totalFetched,
    itemsSeen: capped,
    itemsRead,
    skippedAttempts,
    wildcardEligible,
    sourceErrors: errors,
  };
}
