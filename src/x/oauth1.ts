import { createHmac, randomBytes } from "node:crypto";

export interface OAuth1Credentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

// RFC 3986 percent-encoding, which is stricter than encodeURIComponent —
// !*'() are reserved in RFC 3986 but encodeURIComponent leaves them alone.
// Using OAuth 1.0a's own encoding here is required, not cosmetic: a wrong
// encoding produces a signature X's API will simply reject.
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function nonce(): string {
  return randomBytes(16).toString("hex");
}

// Builds the OAuth 1.0a Authorization header for a request with no query
// string or form-encoded body params in the signature base (X API v2 takes
// a JSON body, which OAuth 1.0a does not sign) — correct for POST /2/tweets
// and simple GETs with no query params. If a GET ever needs query params
// signed too, they'd need to be merged into `params` before calling this.
export function buildOAuth1Header(
  method: "GET" | "POST",
  url: string,
  credentials: OAuth1Credentials,
  extraParams: Record<string, string> = {}
): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: credentials.apiKey,
    oauth_nonce: nonce(),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: credentials.accessToken,
    oauth_version: "1.0",
    ...extraParams,
  };

  const allParams = { ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(allParams[key]!)}`)
    .join("&");

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(credentials.apiSecret)}&${percentEncode(credentials.accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams: Record<string, string> = { ...oauthParams, oauth_signature: signature };
  const headerString = Object.keys(headerParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key]!)}"`)
    .join(", ");

  return `OAuth ${headerString}`;
}
