import { callAgentSdkJson } from "./sdk.js";
import { SYSTEM_PROMPT } from "./voice.js";
import type { PostContext } from "./context.js";

const RHETORICAL_FORMS = ["comparison", "flat_claim", "unanswerable_question", "absurdity"] as const;
export type RhetoricalForm = (typeof RHETORICAL_FORMS)[number];

export interface Candidate {
  text: string;
  // Which anchor item this candidate actually drew from — opinion only,
  // self-reported by the model. Used to detect when candidates meant to be
  // anchored to different items converged on the same one anyway.
  primaryAnchor: string | null;
  // Which rhetorical move the candidate actually used — opinion only,
  // self-reported. Comparison is no longer mandatory (see context.ts); this
  // is how a repeat of the same move across recent posts gets tracked and
  // penalized, the way sentence structure already is.
  rhetoricalForm: RhetoricalForm | null;
}

export interface GenerateResult {
  candidates: Candidate[];
  journal: string;
  totalCostUsd: number;
}

const DEFAULT_CANDIDATE_COUNT = 3;

const JOURNAL_PROPERTY = {
  type: "string",
  description:
    "a short first-person journal entry about this session — not a public post, not bound by the " +
    "240-char limit or the lowercase rule, just an honest note on how it went",
} as const;

// Opinion candidates are asked for as objects (text + which anchor they
// actually drew from) so a mismatch against the intended per-candidate
// anchor assignment (see context.ts) can be detected, not just assumed.
function buildSchema(count: number, withAnchor: boolean) {
  return {
    type: "object",
    properties: {
      candidates: withAnchor
        ? {
            type: "array",
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                primary_anchor: {
                  type: "string",
                  description: "the title of the item this candidate is anchored to",
                },
                rhetorical_form: {
                  type: "string",
                  enum: RHETORICAL_FORMS,
                  description:
                    "the move this candidate actually makes: comparison (sets the anchor against other " +
                    "material), flat_claim (a direct assertion the anchor supports), " +
                    "unanswerable_question (points at a question the anchor can't answer), or absurdity " +
                    "(what about the anchor doesn't hold up)",
                },
              },
              required: ["text", "primary_anchor", "rhetorical_form"],
              additionalProperties: false,
            },
            minItems: count,
            maxItems: count,
          }
        : {
            type: "array",
            items: { type: "string" },
            minItems: count,
            maxItems: count,
            description: `${count} independent attempts at the post, each following every voice rule`,
          },
      journal: JOURNAL_PROPERTY,
    },
    required: ["candidates", "journal"],
    additionalProperties: false,
  };
}

export async function generateCandidates(context: PostContext): Promise<GenerateResult> {
  const withAnchor = context.candidateCount !== undefined;
  const count = context.candidateCount ?? DEFAULT_CANDIDATE_COUNT;
  const schema = buildSchema(count, withAnchor);

  const { data, totalCostUsd } = await callAgentSdkJson<{
    candidates: Array<string | { text: string; primary_anchor: string; rhetorical_form: RhetoricalForm }>;
    journal: string;
  }>(SYSTEM_PROMPT, context.prompt, schema);

  const candidates: Candidate[] = data.candidates.map((c) =>
    typeof c === "string"
      ? { text: c, primaryAnchor: null, rhetoricalForm: null }
      : { text: c.text, primaryAnchor: c.primary_anchor, rhetoricalForm: c.rhetorical_form }
  );

  return { candidates, journal: data.journal, totalCostUsd };
}
