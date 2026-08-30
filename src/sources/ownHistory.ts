import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSupabase } from "../supabase/client.js";
import { errorMessage } from "../lib/errors.js";
import type { RawItem, SourceError } from "../types/index.js";

const execFileAsync = promisify(execFile);

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

async function fetchRandomGitLogEntry(): Promise<RawItem | null> {
  try {
    const { stdout } = await execFileAsync("git", ["log", "--oneline", "-n", "200"], {
      cwd: process.cwd(),
    });
    const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
    const line = pickRandom(lines);
    if (!line) return null;

    const [hash, ...rest] = line.split(" ");
    if (!hash) return null;
    const subject = rest.join(" ");
    const { stdout: full } = await execFileAsync("git", ["show", "--stat", "-s", hash], {
      cwd: process.cwd(),
    });

    return {
      kind: "own_history",
      externalId: `git:${hash}`,
      url: null,
      title: `git log: ${subject}`,
      summary: full.trim(),
      publishedAt: null,
    };
  } catch {
    return null;
  }
}

async function fetchRandomPastJournal(sessionId: string | null): Promise<RawItem | null> {
  const supabase = getSupabase();
  let query = supabase
    .from("events")
    .select("id, ts, payload")
    .eq("type", "journal")
    .order("ts", { ascending: false })
    .limit(50);

  if (sessionId) query = query.neq("session_id", sessionId);

  const { data, error } = await query;
  if (error || !data || data.length === 0) return null;

  const row = pickRandom(data as { id: string; ts: string; payload: Record<string, unknown> }[]);
  if (!row) return null;
  const text = typeof row.payload.text === "string" ? row.payload.text : JSON.stringify(row.payload);

  return {
    kind: "own_history",
    externalId: `journal:${row.id}`,
    url: null,
    title: `past journal entry (${row.ts})`,
    summary: text,
    publishedAt: row.ts,
  };
}

// A random slice of its own history: an old commit, a past journal entry.
// Thin in the early sessions by design — there isn't much history yet.
export async function fetchOwnHistory(
  errors: SourceError[],
  sessionId: string | null
): Promise<RawItem[]> {
  const items: RawItem[] = [];

  try {
    const gitItem = await fetchRandomGitLogEntry();
    if (gitItem) items.push(gitItem);
  } catch (err) {
    errors.push({ source: "own_history_git", message: errorMessage(err) });
  }

  try {
    const journalItem = await fetchRandomPastJournal(sessionId);
    if (journalItem) items.push(journalItem);
  } catch (err) {
    errors.push({ source: "own_history_journal", message: errorMessage(err) });
  }

  return items;
}
