import type { PublicEvent, PublicLedgerEntry, PublicPost, PublicSession } from "./types";

// Not exposed by any public_* view (agent_meta isn't public), so these
// mirror the backend's documented defaults rather than being fetched.
// See src/config/index.ts and src/events/generation.ts in the repo root.
export const SESSION_INTERVAL_HOURS = 3;
export const DAILY_POST_TARGET = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

export function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Mirrors src/events/generation.ts's generationForDate exactly — one
// generation per calendar day since the epoch.
export function generationForDate(dateIso: string, epochIso: string): number {
  const date = Date.parse(`${dateIso}T00:00:00Z`);
  const epoch = Date.parse(`${epochIso}T00:00:00Z`);
  return Math.floor((date - epoch) / DAY_MS) + 1;
}

// The epoch isn't readable directly (agent_meta has no public view), but
// it's recoverable from the earliest session's date — same value, derived
// rather than duplicated.
export function deriveEpochDate(sessions: PublicSession[]): string | null {
  if (sessions.length === 0) return null;
  const earliest = sessions.reduce((min, s) => (s.started_at < min ? s.started_at : min), sessions[0]!.started_at);
  return utcDateString(new Date(earliest));
}

export function currentDayNumber(sessions: PublicSession[], now: Date): number | null {
  const epoch = deriveEpochDate(sessions);
  if (!epoch) return null;
  return generationForDate(utcDateString(now), epoch);
}

export function latestSession(sessions: PublicSession[]): PublicSession | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.started_at > latest.started_at ? s : latest), sessions[0]!);
}

export function isAwake(sessions: PublicSession[]): boolean {
  const latest = latestSession(sessions);
  return latest?.status === "running";
}

export function nextWakeAt(sessions: PublicSession[]): Date | null {
  const latest = latestSession(sessions);
  if (!latest) return null;
  return new Date(new Date(latest.started_at).getTime() + SESSION_INTERVAL_HOURS * 60 * 60 * 1000);
}

export function spentSoFar(entries: PublicLedgerEntry[]): number {
  return entries.filter((e) => e.amount_usd < 0).reduce((sum, e) => sum + Math.abs(e.amount_usd), 0);
}

export function balance(entries: PublicLedgerEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount_usd, 0);
}

export function burnRate7d(entries: PublicLedgerEntry[], now: Date): number {
  const since = now.getTime() - 7 * DAY_MS;
  const spent7d = entries
    .filter((e) => e.amount_usd < 0 && new Date(e.ts).getTime() >= since)
    .reduce((sum, e) => sum + Math.abs(e.amount_usd), 0);
  return spent7d / 7;
}

// null = infinite runway (no burn), 0 = already out.
export function runwayDays(balanceUsd: number, dailyBurn: number): number | null {
  if (dailyBurn <= 0) return null;
  return Math.max(0, balanceUsd / dailyBurn);
}

export function postsToday(posts: PublicPost[], now: Date): number {
  const today = utcDateString(now);
  return posts.filter((p) => utcDateString(new Date(p.ts)) === today).length;
}

export function formatRelativeTime(iso: string, now: Date): string {
  const deltaMs = now.getTime() - new Date(iso).getTime();
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatCountdown(target: Date, now: Date): string {
  const deltaMs = target.getTime() - now.getTime();
  if (deltaMs <= 0) return "any moment now";
  const totalSeconds = Math.floor(deltaMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export type SessionOutcome = "nothing_to_read" | "vetoed" | "posted";

// A silent gap ("asleep") collapses three very different sessions into one
// blank. Distinguish them: nothing cleared the read bar at all, versus
// candidates were generated and every one was vetoed, versus a post
// actually landed.
export function sessionOutcome(events: PublicEvent[]): { outcome: SessionOutcome; itemReadCount: number } {
  const itemReadCount = events.filter((e) => e.type === "item_read").length;
  if (itemReadCount === 0) return { outcome: "nothing_to_read", itemReadCount };
  const posted = events.some((e) => e.type === "post");
  return { outcome: posted ? "posted" : "vetoed", itemReadCount };
}

export function describeSessionOutcome(events: PublicEvent[]): string {
  const { outcome, itemReadCount } = sessionOutcome(events);
  const things = `${itemReadCount} thing${itemReadCount === 1 ? "" : "s"}`;
  switch (outcome) {
    case "nothing_to_read":
      return "nothing new to read";
    case "vetoed":
      return `read ${things}, said nothing`;
    case "posted":
      return `read ${things}, said something`;
  }
}
