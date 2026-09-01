import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getSupabase } from "../supabase/client.js";
import type { ReadingPipelineResult, SeenItem } from "../reading/pipeline.js";
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
}

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

function readPurposeMd(): string {
  try {
    return readFileSync(resolve(REPO_ROOT, "PURPOSE.md"), "utf-8");
  } catch {
    return "";
  }
}

// reply needs a real mention/timeline thread (X integration is step 4) —
// that one still always falls back to opinion, exactly as spec anticipates
// ("expect this to happen often in the first weeks"). artifact now has
// real backing material via the make step.
export async function buildContext(
  category: PostCategory,
  reading: ReadingPipelineResult
): Promise<PostContext | null> {
  switch (category) {
    case "opinion":
      return buildOpinionContext(reading);
    case "process":
      return buildProcessContext(reading) ?? buildOpinionContext(reading);
    case "reflection":
      return buildReflectionContext(reading) ?? buildOpinionContext(reading);
    case "artifact":
      return (await buildArtifactContext()) ?? buildOpinionContext(reading);
    case "reply":
      return buildOpinionContext(reading);
  }
}

function readBlock(kind: string, title: string, text: string): string {
  return `[${kind}] ${title}\n${text.slice(0, 3000)}`;
}

// Every rejection in the first batch failed the same way: paraphrasing one
// source's own stated diagnosis. The fix isn't "reference an item," it's
// forcing a comparison — set two things against each other and say what's
// different, which is where a real position comes from, not a restatement.
//
// One candidate per available read item (not a fixed 3 pulled from
// whichever item the model liked best), each anchored to a different item
// and required to compare it against something else: another read if
// there are 2+, or own history if there's only 1. If there's exactly one
// read and no own-history material, there's no valid comparison — opinion
// can't honestly run this session, same principle as every other fallback
// here: never fabricate what doesn't exist.
function buildOpinionContext(reading: ReadingPipelineResult): PostContext | null {
  const reads = reading.itemsRead;
  if (reads.length === 0) return null;

  const ownHistory: SeenItem[] = reading.itemsSeen.filter((s) => s.item.kind === "own_history");
  if (reads.length === 1 && ownHistory.length === 0) return null;

  const historyBlock =
    ownHistory.length > 0
      ? ownHistory.map((s) => readBlock("own_history", s.item.title, s.item.summary)).join("\n\n")
      : null;

  const anchorBlocks = reads.map((r, i) => {
    const others = reads.filter((_, j) => j !== i);
    const comparisonBlock =
      others.length > 0
        ? others.map((o) => readBlock(o.item.kind, o.item.title, o.fullText)).join("\n\n")
        : (historyBlock as string); // reads.length === 1 guarantees historyBlock is non-null here

    return (
      `--- candidate ${i + 1}: anchored to [${r.item.kind}] ${r.item.title} ---\n` +
      `${readBlock(r.item.kind, r.item.title, r.fullText)}\n\n` +
      `compare it against:\n${comparisonBlock}`
    );
  });

  const prompt =
    "write opinion post candidates. write exactly one candidate per anchor below, in order — each " +
    "candidate must draw on its anchor AND the comparison material given with it, and say what's " +
    "different, what conflicts, or what one leaves out that the other doesn't. a candidate that only " +
    "restates its anchor without setting it against the comparison material fails — that's what caused " +
    "every rejection last time.\n\n" +
    anchorBlocks.join("\n\n");

  const eventIds = [...reads.map((r) => r.eventId), ...ownHistory.map((s) => s.eventId)];
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
