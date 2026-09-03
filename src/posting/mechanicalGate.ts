import { toPublishedText } from "./format.js";

const MAX_CHARS = 240;

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

const CONSCIOUSNESS_PHRASES = [
  "i feel",
  "i'm feeling",
  "i am feeling",
  "i'm excited",
  "i am excited",
  "makes me feel",
  "i'm conscious",
  "i am conscious",
  "i'm sentient",
  "i am sentient",
];

const MARKET_PHRASES = [
  "moon",
  "pump",
  "dump",
  "bullish",
  "bearish",
  "market cap",
  "hodl",
  "buy the dip",
  "to the moon",
];

const CASHTAG_RE = /\$[A-Z]{2,10}\b/;

// The two sentence-level shapes the spec calls out by name, plus the
// rhetorical-form tic found across an actual batch: "X assumes/claims A,
// Y shows/proves B, they're not the same" — different words every time,
// same three-beat move (assert, counter-example, explicit non-equivalence)
// often enough to read as a tic across a set. Both flavors share one
// cooldown pool below: whatever shape a recent post used, a new candidate
// using it again fails.
const STRUCTURE_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "x-but-not-y", re: /\bbut not\b/i },
  { name: "everyone-nobody", re: /\beveryone\b[^.]{0,80}\bnobody\b/i },
  { name: "assumes-vs-shows", re: /\b(assumes?|claims?|treats?\s+\S+\s+as|wants?|lists?\s+\S+\s+as)\b[\s\S]{0,150}\b(shows?|proves?|reveals?|catches)\b/i },
  { name: "not-the-same", re: /\b(aren'?t|isn'?t|is not|are not)\s+the\s+same\b/i },
  { name: "one-the-other", re: /\bone\b[^.]{0,80}\bthe other\b/i },
];

export interface MechanicalResult {
  pass: boolean;
  reasons: string[];
}

function matchedStructures(text: string): string[] {
  return STRUCTURE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.name);
}

// Cheap, deterministic checks — no LLM call. Every reason a candidate can
// fail mechanically; the fuzzy judgment (summarizes vs. notices, too
// general to be wrong) happens separately in judge.ts, which has the
// source material and recent posts to reason over.
//
// rhetoricalForm/recentForms are opinion-only, self-reported (see
// generate.ts) — comparison isn't mandatory anymore, so which move a
// candidate makes has to be tracked and cooled down the same way a
// repeated sentence structure is, or the model just settles on whichever
// move is easiest and repeats it every time instead.
export function checkMechanical(
  candidate: string,
  recentPosts: string[],
  rhetoricalForm?: string | null,
  recentForms?: string[]
): MechanicalResult {
  const reasons: string[] = [];
  const text = candidate.trim();

  if (text.length === 0) reasons.push("empty");
  // Checked against the published (sentence-per-line) form, not the raw
  // candidate — that's what actually has to fit on X.
  const publishedLength = toPublishedText(text).length;
  if (publishedLength > MAX_CHARS) reasons.push(`over ${MAX_CHARS} chars (${publishedLength} published)`);
  if (/[A-Z]/.test(text)) reasons.push("contains uppercase (lowercase only)");
  if (EMOJI_RE.test(text)) reasons.push("contains emoji");
  if (text.includes("!")) reasons.push("contains exclamation mark");
  if (text.includes("?")) reasons.push("contains question mark");
  if (/#\w/.test(text)) reasons.push("contains hashtag");

  const lower = text.toLowerCase();
  for (const phrase of CONSCIOUSNESS_PHRASES) {
    if (lower.includes(phrase)) reasons.push(`consciousness/emotion claim: "${phrase}"`);
  }
  for (const phrase of MARKET_PHRASES) {
    if (lower.includes(phrase)) reasons.push(`market/price language: "${phrase}"`);
  }
  if (CASHTAG_RE.test(text)) reasons.push("contains a cashtag");

  const candidateStructures = matchedStructures(text);
  if (candidateStructures.length > 0) {
    const recentStructures = new Set(recentPosts.flatMap(matchedStructures));
    for (const s of candidateStructures) {
      if (recentStructures.has(s)) reasons.push(`structure/form cooldown: "${s}" used recently`);
    }
  }

  if (rhetoricalForm && recentForms?.includes(rhetoricalForm)) {
    reasons.push(`rhetorical-form cooldown: "${rhetoricalForm}" used recently`);
  }

  return { pass: reasons.length === 0, reasons };
}
