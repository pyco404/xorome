import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeNote, makePlot } from "./generators.js";

const execFileAsync = promisify(execFile);
const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

// Distinct from the human operator's / Claude Code's commits — these are
// the agent's own autonomous commits, and the git history should say so.
const ARTIFACT_AUTHOR = "xorome <bot@xorome.xyz>";

export type ArtifactType = "plot" | "note";

export interface ArtifactResult {
  type: ArtifactType;
  filePath: string;
  title: string;
  content: string;
  commitHash: string;
}

async function git(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: REPO_ROOT });
  return stdout.trim();
}

// One small self-contained thing per session: a plot or a note, computed
// from real event data, committed to the repo. Refuses to commit if
// anything besides the new artifact file is staged — an autonomous commit
// must never sweep in unrelated uncommitted work.
export async function makeAndCommitArtifact(generation: number, sessionId: string): Promise<ArtifactResult> {
  const type: ArtifactType = Math.random() < 0.5 ? "plot" : "note";
  const { content, title } = type === "plot" ? await makePlot() : await makeNote();

  const shortId = sessionId.slice(0, 8);
  const relPath = `artifacts/gen${generation}-${shortId}-${type}.md`;
  const absPath = resolve(REPO_ROOT, relPath);
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content);

  await git(["add", relPath]);

  const staged = (await git(["diff", "--cached", "--name-only"])).split("\n").filter(Boolean);
  if (staged.length !== 1 || staged[0] !== relPath) {
    throw new Error(
      `refusing to commit artifact: staged files are [${staged.join(", ")}], expected only [${relPath}]`
    );
  }

  await git(["commit", "-m", `artifact: ${title}`, `--author=${ARTIFACT_AUTHOR}`]);
  const commitHash = await git(["rev-parse", "HEAD"]);

  return { type, filePath: relPath, title, content, commitHash };
}
