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
  // Present only for candidates that reached the judge (mechanicalPass === true).
  judgeVerdict: "accept" | "reject" | null;
  judgeReason: string | null;
  isWinner: boolean;
}

export interface GeneratePostResult {
  category: PostCategory;
  winner: string | null;
  candidates: CandidateReport[];
  journal: string;
  eventIds: string[];
  totalCostUsd: number;
}

const FALLBACK_JOURNAL = "session ran. no further reflection available this time.";

// Generate 3 candidates, score them, keep the best — or nothing. Returns
// null only when there was truly nothing to write about (e.g. zero items
// read and no fallback material either) — rare, since reply falls back to
// opinion, artifact falls back to opinion only when nothing made yet is
// unreferenced, and opinion only needs one read.
export async function generatePost(reading: ReadingPipelineResult): Promise<GeneratePostResult | null> {
  const category = await pickCategory();
  const context = await buildContext(category, reading);
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
      totalCostUsd: 0,
    };
  }

  const candidates: CandidateReport[] = generated.candidates.map((text) => {
    const result = checkMechanical(text, recentPosts);
    return {
      text,
      mechanicalPass: result.pass,
      mechanicalReasons: result.reasons,
      judgeVerdict: null,
      judgeReason: null,
      isWinner: false,
    };
  });

  const survivorIndices = candidates
    .map((c, i) => (c.mechanicalPass ? i : -1))
    .filter((i) => i >= 0);

  if (survivorIndices.length === 0) {
    return {
      category: context.category,
      winner: null,
      candidates,
      journal: generated.journal,
      eventIds: context.eventIds,
      totalCostUsd: generated.totalCostUsd,
    };
  }

  const judged = await judgeCandidates(
    survivorIndices.map((i) => candidates[i]!.text),
    context.prompt,
    recentPosts
  );

  // judged.evaluations/winnerIndex are indexed into the survivor list, not
  // the original 3 — map back to the real candidate positions.
  for (const evaluation of judged.evaluations) {
    const realIndex = survivorIndices[evaluation.index];
    if (realIndex === undefined) continue;
    candidates[realIndex]!.judgeVerdict = evaluation.verdict;
    candidates[realIndex]!.judgeReason = evaluation.reason;
  }

  let winner: string | null = null;
  if (judged.winnerIndex !== null) {
    const realWinnerIndex = survivorIndices[judged.winnerIndex];
    if (realWinnerIndex !== undefined) {
      candidates[realWinnerIndex]!.isWinner = true;
      winner = candidates[realWinnerIndex]!.text;
    }
  }

  return {
    category: context.category,
    winner,
    candidates,
    journal: generated.journal,
    eventIds: context.eventIds,
    totalCostUsd: generated.totalCostUsd + judged.totalCostUsd,
  };
}
