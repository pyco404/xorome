import { pickCategory } from "./mix.js";
import { buildContext } from "./context.js";
import { generateCandidates } from "./generate.js";
import { checkMechanical } from "./mechanicalGate.js";
import { judgeCandidates } from "./judge.js";
import { fetchRecentPostTexts } from "./recentPosts.js";
import type { ReadingPipelineResult } from "../reading/pipeline.js";
import type { PostCategory } from "../types/index.js";

export interface CandidateReport {
  text: string;
  mechanicalPass: boolean;
  mechanicalReasons: string[];
}

export interface GeneratePostResult {
  category: PostCategory;
  winner: string | null;
  candidates: CandidateReport[];
  journal: string;
  eventIds: string[];
  judgeReasoning: string | null;
  totalCostUsd: number;
}

const FALLBACK_JOURNAL = "session ran. no further reflection available this time.";

// Generate 3 candidates, score them, keep the best — or nothing. Returns
// null only when there was truly nothing to write about (e.g. zero items
// read and no fallback material either), which should be rare since
// reply/artifact fall back to opinion and opinion only needs one read.
export async function generatePost(reading: ReadingPipelineResult): Promise<GeneratePostResult | null> {
  const category = await pickCategory();
  const context = buildContext(category, reading);
  if (!context) return null;

  const recentPosts = await fetchRecentPostTexts();

  let generated;
  try {
    generated = await generateCandidates(context);
  } catch (err) {
    return {
      category: context.category,
      winner: null,
      candidates: [],
      journal: FALLBACK_JOURNAL,
      eventIds: context.eventIds,
      judgeReasoning: `generation failed: ${err instanceof Error ? err.message : String(err)}`,
      totalCostUsd: 0,
    };
  }

  const candidates: CandidateReport[] = generated.candidates.map((text) => {
    const result = checkMechanical(text, recentPosts);
    return { text, mechanicalPass: result.pass, mechanicalReasons: result.reasons };
  });

  const survivors = candidates.filter((c) => c.mechanicalPass);

  if (survivors.length === 0) {
    return {
      category: context.category,
      winner: null,
      candidates,
      journal: generated.journal,
      eventIds: context.eventIds,
      judgeReasoning: "no candidate cleared the mechanical checks",
      totalCostUsd: generated.totalCostUsd,
    };
  }

  const judged = await judgeCandidates(
    survivors.map((c) => c.text),
    context.prompt,
    recentPosts
  );

  const winner =
    judged.verdict === "pass" && judged.winnerIndex !== null
      ? survivors[judged.winnerIndex]?.text ?? null
      : null;

  return {
    category: context.category,
    winner,
    candidates,
    journal: generated.journal,
    eventIds: context.eventIds,
    judgeReasoning: judged.reasoning,
    totalCostUsd: generated.totalCostUsd + judged.totalCostUsd,
  };
}
