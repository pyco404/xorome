import { config as loadEnv } from "dotenv";

loadEnv();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required env var: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`env var ${name} must be a number, got: ${raw}`);
  }
  return value;
}

function optionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.trim().toLowerCase() === "true";
}

export interface Config {
  anthropicApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  maxBudgetUsdPerSession: number;
  sessionIntervalHours: number;
  autoPublish: boolean;
  maxItemsReadPerSession: number;
  githubToken: string | undefined;
  rssFeeds: string[];
  hnAlgoliaBaseUrl: string;
  xApiKey: string | undefined;
  xApiSecret: string | undefined;
  xAccessToken: string | undefined;
  xAccessSecret: string | undefined;
  approvalQueuePort: number;
}

let cached: Config | undefined;

export function getConfig(): Config {
  if (cached) return cached;

  cached = {
    anthropicApiKey: required("ANTHROPIC_API_KEY"),
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    maxBudgetUsdPerSession: optionalNumber("MAX_BUDGET_USD_PER_SESSION", 2),
    sessionIntervalHours: optionalNumber("SESSION_INTERVAL_HOURS", 3),
    autoPublish: optionalBool("AUTO_PUBLISH", false),
    maxItemsReadPerSession: optionalNumber("MAX_ITEMS_READ_PER_SESSION", 3),
    githubToken: process.env.GITHUB_TOKEN || undefined,
    rssFeeds: (process.env.RSS_FEEDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    hnAlgoliaBaseUrl: process.env.HN_ALGOLIA_BASE_URL || "https://hn.algolia.com/api/v1",
    xApiKey: process.env.X_API_KEY || undefined,
    xApiSecret: process.env.X_API_SECRET || undefined,
    xAccessToken: process.env.X_ACCESS_TOKEN || undefined,
    xAccessSecret: process.env.X_ACCESS_SECRET || undefined,
    approvalQueuePort: optionalNumber("APPROVAL_QUEUE_PORT", 4200),
  };

  return cached;
}
