import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReadingPipelineResult } from "../reading/pipeline.js";
import type { PostCategory } from "../types/index.js";

export interface PostContext {
  category: PostCategory;
  prompt: string;
  eventIds: string[];
}

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

function readPurposeMd(): string {
  try {
    return readFileSync(resolve(REPO_ROOT, "PURPOSE.md"), "utf-8");
  } catch {
    return "";
  }
}

// reply needs a real mention/timeline thread (X integration is step 4);
// artifact needs a real thing made this session (the make step is step 5).
// Neither exists yet, so both always fall back to opinion right now — the
// spec anticipates this ("expect this to happen often in the first
// weeks") for reply, and the same principle — never fabricate what
// doesn't exist — extends to artifact.
export function buildContext(category: PostCategory, reading: ReadingPipelineResult): PostContext | null {
  switch (category) {
    case "opinion":
      return buildOpinionContext(reading);
    case "process":
      return buildProcessContext(reading) ?? buildOpinionContext(reading);
    case "reflection":
      return buildReflectionContext(reading) ?? buildOpinionContext(reading);
    case "reply":
    case "artifact":
      return buildOpinionContext(reading);
  }
}

function buildOpinionContext(reading: ReadingPipelineResult): PostContext | null {
  if (reading.itemsRead.length === 0) return null;

  const material = reading.itemsRead
    .map((r, i) => `--- item ${i + 1}: [${r.item.kind}] ${r.item.title} ---\n${r.fullText.slice(0, 3000)}`)
    .join("\n\n");

  return {
    category: "opinion",
    prompt:
      "write an opinion post. below are the items read this session. reference ONE of them specifically " +
      "— what you noticed that the source itself didn't say, not a summary of it.\n\n" +
      material,
    eventIds: reading.itemsRead.map((r) => r.eventId),
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
