import { query } from "@anthropic-ai/claude-agent-sdk";
import { getConfig } from "../config/index.js";

export interface SdkJsonResult<T> {
  data: T;
  totalCostUsd: number;
}

const DEFAULT_MODEL = "claude-sonnet-5";

// Single-turn, tool-free structured-output call. No file/bash access —
// post generation only ever needs to read context it's already been
// handed and produce text.
export async function callAgentSdkJson<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  model: string = DEFAULT_MODEL
): Promise<SdkJsonResult<T>> {
  const config = getConfig();

  const q = query({
    prompt: userPrompt,
    options: {
      systemPrompt,
      tools: [],
      maxTurns: 1,
      maxBudgetUsd: config.maxBudgetUsdPerSession,
      model,
      outputFormat: { type: "json_schema", schema },
      env: { ...process.env },
    },
  });

  for await (const message of q) {
    if (message.type !== "result") {
      console.error(`sdk message: type=${message.type}`, "subtype" in message ? `subtype=${message.subtype}` : "");
      continue;
    }

    const totalCostUsd = message.total_cost_usd;
    if (message.subtype !== "success") {
      throw new Error(`agent sdk call failed: ${message.subtype}`);
    }
    if (message.structured_output === undefined) {
      console.error("agent sdk result with no structured_output:", JSON.stringify(message).slice(0, 4000));
      throw new Error("agent sdk call returned no structured_output");
    }
    return { data: message.structured_output as T, totalCostUsd };
  }

  throw new Error("agent sdk call produced no result message");
}
