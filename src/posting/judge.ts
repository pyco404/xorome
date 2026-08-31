import { callAgentSdkJson } from "./sdk.js";

export interface JudgeResult {
  verdict: "pass" | "none";
  winnerIndex: number | null;
  reasoning: string;
  totalCostUsd: number;
}

const JUDGE_SYSTEM_PROMPT = `you are the quality gate for xorome's posts. you don't write posts — you judge candidates someone else wrote, against exact rules, and you're stricter than the writer.

reject any candidate that summarises its source rather than says what the source didn't. the post is what it noticed, not what the source already said. if a candidate could have been written by someone who only read the headline, reject it.

reject any candidate whose claim is too general to be wrong. "ai agents are the future" fails — nobody could disagree with it because it doesn't say anything. a real position is one a specific, informed reader could push back on.

reject any candidate shaped like a post from the recent-posts list below, even if the words differ — same structure, same rhythm, same move.

if none of the candidates survive all three checks, the verdict is "none". an empty slot costs nothing; a bland post costs credibility. do not pick the least-bad candidate out of obligation — only pick one that actually clears the bar.`;

const SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["pass", "none"] },
    winner_index: {
      type: ["integer", "null"],
      description: "0-based index of the winning candidate, or null if verdict is none",
    },
    reasoning: { type: "string", description: "one or two sentences on why, for each candidate" },
  },
  required: ["verdict", "winner_index", "reasoning"],
  additionalProperties: false,
};

export async function judgeCandidates(
  candidates: string[],
  sourceMaterial: string,
  recentPosts: string[]
): Promise<JudgeResult> {
  const prompt = [
    `candidates:\n${candidates.map((c, i) => `[${i}] ${c}`).join("\n")}`,
    `\nsource material the candidates are responding to:\n${sourceMaterial.slice(0, 4000)}`,
    recentPosts.length > 0
      ? `\nrecent posts (avoid repeating their shape):\n${recentPosts.map((p) => `- ${p}`).join("\n")}`
      : "\nno recent posts yet.",
  ].join("\n");

  const { data, totalCostUsd } = await callAgentSdkJson<{
    verdict: "pass" | "none";
    winner_index: number | null;
    reasoning: string;
  }>(JUDGE_SYSTEM_PROMPT, prompt, SCHEMA);

  return { verdict: data.verdict, winnerIndex: data.winner_index, reasoning: data.reasoning, totalCostUsd };
}
