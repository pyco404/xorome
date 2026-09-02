// Sentence-per-line formatting applied only to the text actually sent to
// X. The stored `content` (site display, judge context, mechanical
// voice-rule checks) stays flowing prose — this is purely a publish-time
// transform, so the character budget check needs to measure this output,
// not the raw candidate, to actually reflect what X will receive.
//
// Matches a period followed by whitespace, not a trailing period with
// nothing after it, so there's no dangling newline at the end.
export function toPublishedText(text: string): string {
  return text.replace(/\.\s+/g, ".\n");
}
