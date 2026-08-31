import purposeHistoryRaw from "../generated/purposeHistory.json";
import { generationForDate, deriveEpochDate, utcDateString } from "./derive";
import type { PublicSession } from "./types";

interface RawPurposeVersion {
  hash: string;
  date: string;
  subject: string;
  content: string;
}

export interface PurposeVersion {
  hash: string;
  date: string;
  content: string;
  // null when the commit predates the epoch (e.g. seeded before any
  // session ever ran) — a real day-number can't be computed for it.
  generation: number | null;
}

const rawVersions = purposeHistoryRaw as RawPurposeVersion[];

// Generation isn't stored in git, so it's derived the same way the
// backend computes it: one generation per calendar day since the epoch,
// and the epoch is recovered from the earliest known session (agent_meta
// itself has no public view). Source: git history for content/dates,
// public_sessions for the epoch.
export function purposeVersions(sessions: PublicSession[]): PurposeVersion[] {
  const epoch = deriveEpochDate(sessions);

  return rawVersions.map((v) => ({
    hash: v.hash,
    date: v.date,
    content: v.content,
    generation: epoch ? generationForDate(utcDateString(new Date(v.date)), epoch) : null,
  }));
}
