import { callAgentSdkJson } from "./sdk.js";

export interface CandidateVerdict {
  index: number;
  verdict: "accept" | "reject";
  reason: string;
}

export interface JudgeResult {
  evaluations: CandidateVerdict[];
  winnerIndex: number | null;
  totalCostUsd: number;
}

const JUDGE_SYSTEM_PROMPT = `you are the quality gate for xorome's posts. you don't write posts — you judge candidates someone else wrote, against exact rules, and you're stricter than the writer.

evaluate every candidate independently, on its own merits, against these four checks:

1. reject if it summarises its source rather than says what the source didn't. the post is what it noticed, not what the source already said. if a candidate could have been written by someone who only read the headline, reject it.
2. reject if its claim is too general to be wrong. "ai agents are the future" fails — nobody could disagree with it because it doesn't say anything. a real position is one a specific, informed reader could push back on.
3. reject if it's shaped like a post from the recent-posts list below, even if the words differ — same structure, same rhythm, same move.
4. for opinion candidates specifically (you'll see anchor/comparison material below if so): reject if it only draws on one source instead of actually comparing two things. every rejection in the last batch failed this exact way — paraphrasing one source's own stated diagnosis instead of setting it against something else. a candidate that mentions its comparison material in passing without the position depending on it still fails this check.

give every candidate its own verdict and its own one-sentence reason, even the ones that pass. then, among the candidates you accepted (if any), pick the single strongest as the winner. if you accepted none, winner_index is null. do not pick a winner out of obligation — only from candidates that actually cleared all three checks.`;

const SCHEMA = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", description: "0-based index matching the candidate list" },
          verdict: { type: "string", enum: ["accept", "reject"] },
          reason: { type: "string", description: "one sentence, specific to this candidate" },
        },
        required: ["index", "verdict", "reason"],
        additionalProperties: false,
      },
    },
    winner_index: {
      type: ["integer", "null"],
      description: "0-based index of the strongest accepted candidate, or null if none were accepted",
    },
  },
  required: ["evaluations", "winner_index"],
  additionalProperties: false,
};

export async function judgeCandidates(
  candidates: string[],
  sourceMaterial: string,
  recentPosts: string[]
): Promise<JudgeResult> {
  const prompt = [
    `candidates:\n${candidates.map((c, i) => `[${i}] ${c}`).join("\n")}`,
    // Generous cap, not a real truncation in practice. The opinion prompt
    // now repeats each read across multiple anchor/comparison blocks (up
    // to 3 anchors, each pairing its own item with the others), so this
    // needs more headroom than a single-pass read list did. A prior
    // 4000-char cap silently cut off later items, and the judge rejected
    // candidates for not addressing material it had literally never seen.
    `\nsource material the candidates are responding to:\n${sourceMaterial.slice(0, 30000)}`,
    recentPosts.length > 0
      ? `\nrecent posts (avoid repeating their shape):\n${recentPosts.map((p) => `- ${p}`).join("\n")}`
      : "\nno recent posts yet.",
  ].join("\n");

  const { data, totalCostUsd } = await callAgentSdkJson<{
    evaluations: CandidateVerdict[];
    winner_index: number | null;
  }>(JUDGE_SYSTEM_PROMPT, prompt, SCHEMA);

  return { evaluations: data.evaluations, winnerIndex: data.winner_index, totalCostUsd };
}
