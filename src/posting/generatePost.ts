import { pickCategoryOrder } from "./mix.js";
import { buildContext } from "./context.js";
import type { PostContext } from "./context.js";
import { generateCandidates } from "./generate.js";
import { checkMechanical } from "./mechanicalGate.js";
import { judgeCandidates } from "./judge.js";
import { fetchRecentPostTexts, fetchRecentRhetoricalForms } from "./recentPosts.js";
import type { ReadingPipelineResult } from "../reading/pipeline.js";
import type { PostCategory } from "../types/index.js";

export interface CandidateReport {
  text: string;
  primaryAnchor: string | null;
  rhetoricalForm: string | null;
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
  // Opinion only: true when every candidate's self-reported primary_anchor
  // collapsed to the same item despite being assigned different ones — the
  // "one candidate per item" mandate didn't take.
  anchorCollapseSignal: boolean;
  replyToTweetId?: string;
}

const FALLBACK_JOURNAL = "session ran. no further reflection available this time.";

function computeAnchorCollapse(intended: string[] | undefined, candidates: CandidateReport[]): boolean {
  if (!intended || intended.length < 2) return false;
  const reported = candidates.map((c) => c.primaryAnchor).filter((a): a is string => a !== null);
  if (reported.length < intended.length) return false;
  return new Set(reported).size === 1;
}

// Generate one candidate per anchor (opinion) or 3 independent candidates
// (everything else), score them, keep the best — or nothing. Tries
// categories in deficit order (see pickCategoryOrder) until one actually
// has material, rather than jumping straight to opinion the moment the
// single most-deficient pick can't be built. Returns null only when
// nothing in that whole order had material — rare, since opinion only
// needs one read and sits last in the order once it's over-represented.
export async function generatePost(reading: ReadingPipelineResult): Promise<GeneratePostResult | null> {
  const order = await pickCategoryOrder();

  let context: PostContext | null = null;
  for (const candidate of order) {
    context = await buildContext(candidate, reading);
    if (context) break;
  }
  if (!context) return null;

  const recentPosts = await fetchRecentPostTexts();
  const recentForms = context.category === "opinion" ? await fetchRecentRhetoricalForms() : [];

  let generated;
  try {
    generated = await generateCandidates(context);
  } catch (err) {
    console.error("generateCandidates failed:", err);
    return {
      category: context.category,
      winner: null,
      candidates: [],
      journal: FALLBACK_JOURNAL,
      eventIds: context.eventIds,
      totalCostUsd: 0,
      anchorCollapseSignal: false,
      replyToTweetId: context.replyToTweetId,
    };
  }

  const candidates: CandidateReport[] = generated.candidates.map((c) => {
    const result = checkMechanical(c.text, recentPosts, c.rhetoricalForm, recentForms);
    return {
      text: c.text,
      primaryAnchor: c.primaryAnchor,
      rhetoricalForm: c.rhetoricalForm,
      mechanicalPass: result.pass,
      mechanicalReasons: result.reasons,
      judgeVerdict: null,
      judgeReason: null,
      isWinner: false,
    };
  });

  const anchorCollapseSignal = computeAnchorCollapse(context.anchors, candidates);

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
      anchorCollapseSignal,
      replyToTweetId: context.replyToTweetId,
    };
  }

  const judged = await judgeCandidates(
    survivorIndices.map((i) => candidates[i]!.text),
    context.prompt,
    recentPosts
  );

  // judged.evaluations/winnerIndex are indexed into the survivor list, not
  // the original candidate list — map back to the real positions.
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
    anchorCollapseSignal,
    replyToTweetId: context.replyToTweetId,
  };
}
