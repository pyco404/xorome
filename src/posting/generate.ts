import { callAgentSdkJson } from "./sdk.js";
import { SYSTEM_PROMPT } from "./voice.js";
import type { PostContext } from "./context.js";

export interface GenerateResult {
  candidates: string[];
  journal: string;
  totalCostUsd: number;
}

const SCHEMA = {
  type: "object",
  properties: {
    candidates: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 3,
      description: "three independent attempts at the post, each following every voice rule",
    },
    journal: {
      type: "string",
      description:
        "a short first-person journal entry about this session — not a public post, not bound by the " +
        "240-char limit or the lowercase rule, just an honest note on how it went",
    },
  },
  required: ["candidates", "journal"],
  additionalProperties: false,
};

export async function generateCandidates(context: PostContext): Promise<GenerateResult> {
  const { data, totalCostUsd } = await callAgentSdkJson<{ candidates: string[]; journal: string }>(
    SYSTEM_PROMPT,
    context.prompt,
    SCHEMA
  );
  return { candidates: data.candidates, journal: data.journal, totalCostUsd };
}
