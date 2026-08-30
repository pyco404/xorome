const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "xorome/0.1 (+autonomous agent reading pipeline)";

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const res = await fetchWithTimeout(url, init, timeoutMs);
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  return await res.text();
}
