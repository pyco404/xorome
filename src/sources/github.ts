import { fetchJson } from "../lib/http.js";
import { errorMessage } from "../lib/errors.js";
import { getConfig } from "../config/index.js";
import { WATCHLIST_REPOS } from "./watchlist.js";
import type { RawItem, SourceError } from "../types/index.js";

interface GhRepo {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
}

interface GhSearchResponse {
  items: GhRepo[];
}

interface GhRelease {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  body: string | null;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

interface GhIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  created_at: string;
  pull_request?: unknown;
}

function authHeaders(): Record<string, string> {
  const token = getConfig().githubToken;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

// Markers seen on issues filed by another autonomous agent rather than a
// person (e.g. elizaOS/eliza#30112, #30153) — a footer disclosing the
// filing pipeline and model. Checked against the full, untruncated body:
// these tend to sit at the end, past where the stored summary gets cut off.
const AGENT_AUTHORSHIP_MARKERS = [
  /standing operator authorization/i,
  /autonomous audit pipeline/i,
  /AI provider\/model:/i,
];

function detectAgentAuthorship(body: string | null): boolean {
  if (!body) return false;
  return AGENT_AUTHORSHIP_MARKERS.some((re) => re.test(body));
}

// GitHub has no official "trending" API, and its search qualifiers can't be
// OR'd (confirmed against the live API — "topic:a OR topic:b" either 422s
// or, wrapped in parens with another qualifier, silently matches nothing,
// since the OR is ignored and every term is ANDed instead). So this queries
// each topic separately and merges by star count, as a documented stand-in
// for github.com/trending rather than a scrape of it.
const TRENDING_TOPICS = ["ai-agents", "llm-agents", "agent-framework", "autonomous-agents"];
const TRENDING_LIMIT = 5;
const PER_TOPIC_LIMIT = 5;

export async function fetchGithubTrending(errors: SourceError[]): Promise<RawItem[]> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const byRepo = new Map<string, GhRepo>();

  for (const topic of TRENDING_TOPICS) {
    const query = `topic:${topic} pushed:>${since}`;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      query
    )}&sort=stars&order=desc&per_page=${PER_TOPIC_LIMIT}`;

    try {
      const res = await fetchJson<GhSearchResponse>(url, { headers: authHeaders() });
      for (const repo of res.items) byRepo.set(repo.full_name, repo);
    } catch (err) {
      errors.push({ source: "github_trending", message: `${topic}: ${errorMessage(err)}`, url });
    }
  }

  return [...byRepo.values()]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, TRENDING_LIMIT)
    .map((repo) => ({
      kind: "github_trending" as const,
      externalId: repo.full_name,
      url: repo.html_url,
      title: repo.full_name,
      summary: repo.description ?? "",
      publishedAt: repo.pushed_at,
      raw: { stars: repo.stargazers_count },
    }));
}

export async function fetchGithubReleases(errors: SourceError[]): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const repo of WATCHLIST_REPOS) {
    const url = `https://api.github.com/repos/${repo}/releases?per_page=1`;
    try {
      const releases = await fetchJson<GhRelease[]>(url, { headers: authHeaders() });
      for (const release of releases) {
        if (release.draft) continue;
        items.push({
          kind: "github_release" as const,
          externalId: `${repo}#release:${release.id}`,
          url: release.html_url,
          title: `${repo} ${release.name || release.tag_name}`,
          summary: (release.body ?? "").slice(0, 4000),
          publishedAt: release.published_at,
          raw: { repo, prerelease: release.prerelease },
        });
      }
    } catch (err) {
      errors.push({ source: "github_release", message: `${repo}: ${errorMessage(err)}`, url });
    }
  }

  return items;
}

const ISSUES_PER_REPO = 2;

export async function fetchGithubIssues(errors: SourceError[]): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const repo of WATCHLIST_REPOS) {
    const url = `https://api.github.com/repos/${repo}/issues?state=open&sort=created&direction=desc&per_page=${
      ISSUES_PER_REPO * 2
    }`;
    try {
      const issues = await fetchJson<GhIssue[]>(url, { headers: authHeaders() });
      const realIssues = issues.filter((i) => !i.pull_request).slice(0, ISSUES_PER_REPO);
      for (const issue of realIssues) {
        items.push({
          kind: "github_issue" as const,
          externalId: `${repo}#issue:${issue.number}`,
          url: issue.html_url,
          title: `${repo}#${issue.number} ${issue.title}`,
          summary: (issue.body ?? "").slice(0, 4000),
          publishedAt: issue.created_at,
          authoredByAgent: detectAgentAuthorship(issue.body),
          raw: { repo },
        });
      }
    } catch (err) {
      errors.push({ source: "github_issue", message: `${repo}: ${errorMessage(err)}`, url });
    }
  }

  return items;
}

// README for a trending repo the pipeline decided to read in full.
export async function fetchGithubReadme(repoFullName: string): Promise<string> {
  const url = `https://api.github.com/repos/${repoFullName}/readme`;
  const res = await fetchJson<{ content: string; encoding: string }>(url, {
    headers: authHeaders(),
  });
  if (res.encoding !== "base64") throw new Error(`unexpected encoding: ${res.encoding}`);
  return Buffer.from(res.content, "base64").toString("utf-8").slice(0, 6000);
}
