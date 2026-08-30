// GitHub repos this agent tracks for releases and open issues. Verified
// live against the GitHub API when this was written — repos do get renamed
// (claude-agent-sdk -> claude-agent-sdk-typescript happened once already),
// so a 404 here should be logged as an error and skipped, never thrown.
export const WATCHLIST_REPOS = [
  "elizaOS/eliza",
  "langchain-ai/langgraph",
  "anthropics/claude-agent-sdk-typescript",
  "blorm-network/ZerePy",
] as const;
