import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabase } from "../supabase/client.js";
import type { ReadingPipelineResult } from "../reading/pipeline.js";
import type { PostCategory } from "../types/index.js";

export interface PostContext {
  category: PostCategory;
  prompt: string;
  eventIds: string[];
  // Opinion only: one candidate per anchor, not a fixed 3 — see
  // buildOpinionContext. Other categories omit this and generate.ts falls
  // back to asking for 3 independent candidates.
  candidateCount?: number;
  anchors?: string[];
  // reply only: the X tweet id being replied to.
  replyToTweetId?: string;
}

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

function readPurposeMd(): string {
  try {
    return readFileSync(resolve(REPO_ROOT, "PURPOSE.md"), "utf-8");
  } catch {
    return "";
  }
}

// Builds context for exactly the category asked for — no internal
// fallback. A category picked by pickCategoryOrder() but structurally
// unable to produce material this session (reply with no mentions read,
// process with no errors) returns null; the caller (generatePost.ts)
// tries the next category in deficit order rather than collapsing
// straight to opinion, so one perpetually-empty category (reply, until
// real X mentions exist) can't starve every other one behind it.
export async function buildContext(
  category: PostCategory,
  reading: ReadingPipelineResult
): Promise<PostContext | null> {
  switch (category) {
    case "opinion":
      return buildOpinionContext(reading);
    case "process":
      return buildProcessContext(reading);
    case "reflection":
      return buildReflectionContext(reading);
    case "artifact":
      return buildArtifactContext();
    case "reply":
      return buildReplyContext(reading);
  }
}

// Returns null whenever there's nothing worth replying to — no mentions
// were read this session — exactly as spec anticipates ("expect this to
// happen often in the first weeks"). Uses the mention's own text as
// context, not a full walked thread: X's reverse-chronological/thread
// APIs need more than the mentions endpoint alone, and this is genuinely
// untested against the live API either way (no X credentials to test
// with) — keeping the scope bounded here rather than compounding
// unverified surface area.
function buildReplyContext(reading: ReadingPipelineResult): PostContext | null {
  const mentionRead = reading.itemsRead.find((r) => r.item.kind === "x_mentions");
  if (!mentionRead) return null;

  return {
    category: "reply",
    prompt:
      "write a reply post. below is the mention you're replying to — the full text of what they said.\n\n" +
      readBlock("x_mentions", mentionRead.item.title, mentionRead.fullText),
    eventIds: [mentionRead.eventId],
    replyToTweetId: mentionRead.item.externalId,
  };
}

function readBlock(kind: string, title: string, text: string): string {
  return `[${kind}] ${title}\n${text.slice(0, 3000)}`;
}

// Forcing a comparison fixed the original failure mode (paraphrasing a
// source's own stated diagnosis) but overcorrected into a new one: a
// candidate that dutifully sets two things against each other and stops
// at the difference, asserting nothing anyone could disagree with —
// "an empty list means wildcard in one function, empty set in another" is
// a true, specific observation and not a position. Comparison is one way
// to reach a real claim, not the only one; a flat assertion, a question
// the source can't answer, or something found absurd can get there too.
// What's mandatory now is the claim itself, checked in judge.ts, not the
// shape it arrives in.
//
// One candidate per available read item (not a fixed 3 pulled from
// whichever item the model liked best), each anchored to a different
// item. Own-history material is deliberately left out: opinions are about
// the world, not about xorome — that's the reflection slot's job.
function buildOpinionContext(reading: ReadingPipelineResult): PostContext | null {
  const reads = reading.itemsRead;
  if (reads.length === 0) return null;

  const anchorBlocks = reads.map((r, i) => {
    const others = reads.filter((_, j) => j !== i);
    const othersBlock =
      others.length > 0
        ? `\n\nother material available this session, if a comparison actually earns its place:\n${others
            .map((o) => readBlock(o.item.kind, o.item.title, o.fullText))
            .join("\n\n")}`
        : "";

    return (
      `--- candidate ${i + 1}: anchored to [${r.item.kind}] ${r.item.title} ---\n` +
      `${readBlock(r.item.kind, r.item.title, r.fullText)}${othersBlock}`
    );
  });

  const prompt =
    "write opinion post candidates. write exactly one candidate per anchor below, in order.\n\n" +
    "two requirements, non-negotiable:\n" +
    "1. assert something arguable — a position a specific, informed reader could push back on. noticing " +
    "a difference is not a claim. \"in langgraph's subscription code, an empty list means wildcard in " +
    "one function and empty set in another\" is true and specific and asserts nothing — nobody can " +
    "disagree with it, it just states what is. compare that to: \"most agent benchmarks measure whether " +
    "the thing finished. almost none measure whether it should have started.\" or: \"if your test suite " +
    "was written by the thing it tests, you don't have a test suite. you have a preference.\" both take " +
    "a position someone could argue with.\n" +
    "2. stand alone — a reader who has never heard of this repo, function, or paper must be able to " +
    "follow the post and see why it matters, with no prior context. if the claim only makes sense to " +
    "someone who already knows the source, it fails this even if check 1 passes.\n\n" +
    "how you get there is your choice, chosen per candidate, not fixed in advance: set the anchor " +
    "against the other material below if a real comparison earns its place, state a flat claim the " +
    "anchor supports, ask a question the anchor can't answer, or say what about it is absurd. do not " +
    "default to comparison just because other material is available — vary it across the candidates " +
    "below rather than reaching for the same move every time.\n\n" +
    anchorBlocks.join("\n\n");

  const eventIds = reads.map((r) => r.eventId);
  const anchors = reads.map((r) => r.item.title);

  return {
    category: "opinion",
    prompt,
    eventIds,
    candidateCount: anchors.length,
    anchors,
  };
}

function buildProcessContext(reading: ReadingPipelineResult): PostContext | null {
  if (reading.loggedErrors.length > 0) {
    const material = reading.loggedErrors
      .map((e, i) => `--- error ${i + 1}: [${e.error.source}] ---\n${e.error.message}`)
      .join("\n\n");
    return {
      category: "process",
      prompt:
        "write a process/failure post: what broke or wasted time this session. below are the actual " +
        "errors from fetching sources this session. be specific about what happened, not generic.\n\n" +
        material,
      eventIds: reading.loggedErrors.map((e) => e.eventId),
    };
  }

  const ownErrorItems = reading.itemsSeen.filter((s) => s.item.kind === "own_error");
  if (ownErrorItems.length > 0) {
    const material = ownErrorItems.map((s) => `--- ${s.item.title} ---\n${s.item.summary}`).join("\n\n");
    return {
      category: "process",
      prompt:
        "write a process/failure post: what broke or wasted time recently. below is a recent entry " +
        "from your own error log.\n\n" +
        material,
      eventIds: ownErrorItems.map((s) => s.eventId),
    };
  }

  return null;
}

function buildReflectionContext(reading: ReadingPipelineResult): PostContext | null {
  const ownHistoryItems = reading.itemsSeen.filter((s) => s.item.kind === "own_history");
  if (ownHistoryItems.length === 0) return null;

  const purpose = readPurposeMd().trim();
  const purposeSection = purpose
    ? `\n\ncurrent PURPOSE.md content:\n${purpose}`
    : "\n\nPURPOSE.md is currently empty.";

  const material = ownHistoryItems.map((s) => `--- ${s.item.title} ---\n${s.item.summary}`).join("\n\n");

  return {
    category: "reflection",
    prompt:
      "write a reflection post: on your own history, or on PURPOSE.md. below is a random slice of your " +
      `own past (git log, past journal entries).${purposeSection}\n\n${material}`,
    eventIds: ownHistoryItems.map((s) => s.eventId),
  };
}

const ARTIFACT_LOOKBACK = 15;
const POST_LOOKBACK = 30;

// The most recent artifact event that no post has referenced yet — so the
// same made thing doesn't get posted about twice.
async function buildArtifactContext(): Promise<PostContext | null> {
  const supabase = getSupabase();

  const { data: artifacts, error: artifactError } = await supabase
    .from("events")
    .select("id, payload, ts")
    .eq("type", "artifact")
    .order("ts", { ascending: false })
    .limit(ARTIFACT_LOOKBACK);
  if (artifactError) throw artifactError;
  if (!artifacts || artifacts.length === 0) return null;

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select("event_ids")
    .order("ts", { ascending: false })
    .limit(POST_LOOKBACK);
  if (postsError) throw postsError;

  const referenced = new Set((posts ?? []).flatMap((p) => p.event_ids as string[]));
  const unreferenced = artifacts.find((a) => !referenced.has(a.id));
  if (!unreferenced) return null;

  const payload = unreferenced.payload as Record<string, unknown>;

  return {
    category: "artifact",
    prompt:
      "write an artifact post: about the thing you made. below is what you made and committed " +
      `to the repo.\n\n--- ${String(payload.title)} (${String(payload.artifactType)}) ---\n` +
      `file: ${String(payload.filePath)}\ncommit: ${String(payload.commitHash)}\n\n` +
      String(payload.content ?? ""),
    eventIds: [unreferenced.id],
  };
}
