import { buildOAuth1Header, type OAuth1Credentials } from "./oauth1.js";
import { getConfig } from "../config/index.js";

const API_BASE = "https://api.twitter.com";
const TIMEOUT_MS = 10_000;

// X's error responses carry a useful JSON body (why the signature/request
// was rejected). The shared fetchJson helper discards that on failure —
// worth the duplication here specifically, since this integration has
// never been exercised against the real API and good error text is what
// makes the first real failure debuggable instead of just "401".
async function xFetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const bodyText = await res.text();
    if (!res.ok) {
      throw new Error(`${init.method ?? "GET"} ${url} -> ${res.status} ${res.statusText}: ${bodyText.slice(0, 500)}`);
    }
    return bodyText ? (JSON.parse(bodyText) as T) : ({} as T);
  } finally {
    clearTimeout(timer);
  }
}

export function isXConfigured(): boolean {
  const c = getConfig();
  return Boolean(c.xApiKey && c.xApiSecret && c.xAccessToken && c.xAccessSecret);
}

function credentials(): OAuth1Credentials {
  const c = getConfig();
  if (!c.xApiKey || !c.xApiSecret || !c.xAccessToken || !c.xAccessSecret) {
    throw new Error("X credentials not configured (X_API_KEY/X_API_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET)");
  }
  return { apiKey: c.xApiKey, apiSecret: c.xApiSecret, accessToken: c.xAccessToken, accessSecret: c.xAccessSecret };
}

interface PostTweetResponse {
  data: { id: string; text: string };
}

// POST /2/tweets takes a JSON body, which OAuth 1.0a doesn't sign (only
// the OAuth params go into the signature base string for a JSON request) —
// see oauth1.ts's header comment.
export async function postTweet(text: string, inReplyToTweetId?: string): Promise<{ id: string; text: string }> {
  const url = `${API_BASE}/2/tweets`;
  const auth = buildOAuth1Header("POST", url, credentials());
  const body: Record<string, unknown> = { text };
  if (inReplyToTweetId) body.reply = { in_reply_to_tweet_id: inReplyToTweetId };

  const res = await xFetchJson<PostTweetResponse>(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.data;
}

interface MeResponse {
  data: { id: string; username: string; name: string };
}

let cachedUserId: string | null = null;

export async function getOwnUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const url = `${API_BASE}/2/users/me`;
  const auth = buildOAuth1Header("GET", url, credentials());
  const res = await xFetchJson<MeResponse>(url, { headers: { Authorization: auth } });
  cachedUserId = res.data.id;
  return cachedUserId;
}

export interface XMention {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  conversationId: string;
}

interface MentionsResponse {
  data?: Array<{ id: string; text: string; author_id: string; created_at: string; conversation_id: string }>;
}

const MENTIONS_LIMIT = 10;

export async function fetchRecentMentions(sinceId?: string): Promise<XMention[]> {
  const userId = await getOwnUserId();
  const params = new URLSearchParams({
    max_results: String(MENTIONS_LIMIT),
    "tweet.fields": "created_at,author_id,conversation_id",
  });
  if (sinceId) params.set("since_id", sinceId);

  const url = `${API_BASE}/2/users/${userId}/mentions?${params.toString()}`;
  const auth = buildOAuth1Header("GET", url, credentials());
  const res = await xFetchJson<MentionsResponse>(url, { headers: { Authorization: auth } });

  return (res.data ?? []).map((t) => ({
    id: t.id,
    text: t.text,
    authorId: t.author_id,
    createdAt: t.created_at,
    conversationId: t.conversation_id,
  }));
}
