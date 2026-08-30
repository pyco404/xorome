import { fetchText } from "../lib/http.js";
import { errorMessage } from "../lib/errors.js";
import type { RawItem, SourceError } from "../types/index.js";

const CATEGORIES = ["cs.AI", "cs.MA", "cs.SE", "cs.CL", "cs.NE", "cs.HC"];
const PER_CATEGORY = 2;

export async function fetchArxiv(errors: SourceError[]): Promise<RawItem[]> {
  const items: RawItem[] = [];

  for (const category of CATEGORIES) {
    const url =
      `http://export.arxiv.org/api/query?search_query=cat:${category}` +
      `&sortBy=submittedDate&sortOrder=descending&max_results=${PER_CATEGORY}`;
    try {
      const xml = await fetchText(url);
      items.push(...parseEntries(xml, category));
    } catch (err) {
      errors.push({ source: "arxiv", message: `${category}: ${errorMessage(err)}`, url });
    }
  }

  return items;
}

function parseEntries(xml: string, category: string): RawItem[] {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
  return entries.map((m) => {
    const block = m[1] ?? "";
    const id = tag(block, "id");
    return {
      kind: "arxiv" as const,
      externalId: id,
      url: id,
      title: collapse(tag(block, "title")),
      summary: collapse(tag(block, "summary")),
      publishedAt: tag(block, "published") || null,
      raw: { category },
    };
  });
}

function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`));
  return m ? (m[1] ?? "").trim() : "";
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
