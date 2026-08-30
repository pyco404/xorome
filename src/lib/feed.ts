import { decodeEntities } from "./html.js";

export interface FeedEntry {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  guid: string;
}

// Minimal, tolerant RSS 2.0 / Atom parser. Not spec-complete — good enough
// for the handful of well-formed feeds this pipeline reads. No dependency
// pulled in for this on purpose.
export function parseFeed(xml: string, maxEntries = 3): FeedEntry[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = isAtom
    ? matchAll(xml, /<entry[\s\S]*?<\/entry>/gi)
    : matchAll(xml, /<item[\s\S]*?<\/item>/gi);

  return blocks.slice(0, maxEntries).map((block) => {
    const title = clean(tag(block, "title"));
    const link = isAtom ? atomLink(block) : clean(tag(block, "link"));
    const summaryRaw = tag(block, isAtom ? "summary" : "description") || tag(block, "content");
    const summary = shallowStrip(clean(summaryRaw));
    const publishedRaw = tag(block, isAtom ? "updated" : "pubDate") || tag(block, "published");
    const guid = clean(tag(block, isAtom ? "id" : "guid")) || link;
    return { title, link, summary, publishedAt: publishedRaw || null, guid };
  });
}

function matchAll(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => m[0]);
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return "";
  return (m[1] ?? "").replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function atomLink(block: string): string {
  const hrefs = [...block.matchAll(/<link\b[^>]*\/?>(?:<\/link>)?/gi)];
  for (const raw of hrefs) {
    const relMatch = (raw[0] ?? "").match(/rel="([^"]*)"/i);
    const rel = relMatch ? relMatch[1] ?? "alternate" : "alternate";
    const hrefMatch = (raw[0] ?? "").match(/href="([^"]+)"/i);
    if (hrefMatch?.[1] && (rel === "alternate" || !relMatch)) return hrefMatch[1];
  }
  const any = block.match(/<link[^>]*href="([^"]+)"/i);
  return any?.[1] ?? "";
}

function clean(s: string): string {
  return decodeEntities(s).trim();
}

function shallowStrip(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
}
