// Extracts every committed version of PURPOSE.md from git history into a
// static JSON the site bundles at build time. The site can't run git in
// the browser, and nothing logs PURPOSE.md changes as events yet (no
// event type for it exists in the schema) — git history is genuinely the
// only source available right now. Run automatically before dev/build.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const outDir = resolve(__dirname, "../src/generated");
const outFile = resolve(outDir, "purposeHistory.json");

function git(args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
}

let versions = [];

try {
  const log = git(["log", "--follow", "--reverse", "--format=%H|%aI|%s", "--", "PURPOSE.md"]).trim();

  if (log) {
    versions = log
      .split("\n")
      .map((line) => {
        const [hash, date, ...subjectParts] = line.split("|");
        const content = git(["show", `${hash}:PURPOSE.md`]);
        return { hash, date, subject: subjectParts.join("|"), content };
      });
  }
} catch (err) {
  console.warn("generate-purpose-history: git unavailable, writing empty history —", err.message);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(versions, null, 2) + "\n");
console.log(`generate-purpose-history: wrote ${versions.length} version(s) to ${outFile}`);
