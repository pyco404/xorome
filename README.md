# xorome

an autonomous ai agent on solana, finding purpose while building itself.

Phase 1, step 2: the reading pipeline is wired up — sources, dedupe, event
logging. No post generation or posting yet.

## Setup

```bash
npm install
cp .env.example .env
# fill in ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

Run `supabase/migrations/0001_init.sql`, then `0002_posts_event_ids_integrity.sql`,
in the Supabase SQL editor (or via the Supabase CLI if the project is
linked), then verify:

```bash
npm run db:check
```

## Schema

- `sessions` — one row per session run; `generation` is the agent's
  generation counter (identity column, starts at 1).
- `events` — append-only log of everything seen and done. Source of truth
  for the site later.
- `posts` — generated posts, `status: pending` by default. `event_ids` must
  be non-empty (enforced by a `CHECK` using `cardinality()`, not
  `array_length()` — the latter returns `NULL`, not `0`, for an empty array,
  which a `CHECK` constraint treats as passing) and every id in it must
  reference a real row in `events` (enforced by a trigger, migration 0002).
  Nothing gets posted that isn't backed by a logged event.
- `ledger` — every dollar in and out. Balance, burn rate, and runway are
  always computed from this table, never stored as fields.

All four tables have RLS enabled with no policies yet — only the
service-role key (server-side) can read or write until the approval-queue
UI in step 4 gets its own scoped policies.

## Reading pipeline

```bash
npm run read
```

Starts a session, fetches all sources in parallel, dedupes against the last
60 days of `item_seen` events, logs `item_seen` for everything new (capped
at 40), picks a source-diverse sample (`MAX_ITEMS_READ_PER_SESSION`, default
3) and logs `item_read` with full text for those, logs any per-source
fetch failures as `error` events, then marks the session `completed`.

Sources (`src/sources/`):

- `arxiv.ts` — new submissions across the 6 categories in the spec
- `github.ts` — trending (no official API; approximated by querying each of
  4 agent/infra topics separately via search and merging by stars — GitHub
  qualifiers can't be OR'd, confirmed against the live API), releases and
  open issues for the watchlist in `watchlist.ts` (verified against the
  GitHub API: `elizaOS/eliza`, `langchain-ai/langgraph`,
  `anthropics/claude-agent-sdk-typescript`, `blorm-network/ZerePy`)
- `hackernews.ts` — front page + recent agent-related comments (Algolia)
- `rss.ts` — feeds from `RSS_FEEDS` in `.env`; only feeds confirmed live are
  pre-filled (Anthropic, Gwern, and Ribbonfarm didn't have a working feed
  URL as of this writing)
- `ownHistory.ts` / `ownErrors.ts` — a random past commit and journal entry;
  its own recent error events
- `wildcard.ts` — one random Wikipedia article
- `xTimeline.ts` — stubbed (returns nothing) until step 4 adds X credentials

`src/reading/pipeline.ts` orchestrates all of the above; `select.ts` picks
the read sample by source-diversity, not by any judgment about what's
interesting — that call is for the agent in post generation (step 3), not
the harness.

## PURPOSE.md

Empty at generation 1. Nothing in the harness ever prompts, edits, or
prunes it — only the agent, from within a session, may write to it.

## Config (`.env`)

| var | default | notes |
|---|---|---|
| `MAX_BUDGET_USD_PER_SESSION` | `2` | hard cap; session should stop before exceeding it |
| `SESSION_INTERVAL_HOURS` | `3` | 8 sessions/day |
| `AUTO_PUBLISH` | `false` | when false, posts sit in the approval queue |
| `MAX_ITEMS_READ_PER_SESSION` | `3` | of the 20-40 items seen, how many get read in full |
| `GITHUB_TOKEN` | _(none)_ | optional; raises GitHub API rate limit from 60/hr to 5000/hr |
| `RSS_FEEDS` | 4 verified feeds | comma-separated RSS/Atom URLs |
| `HN_ALGOLIA_BASE_URL` | `https://hn.algolia.com/api/v1` | |

## Status

- [x] step 1 — scaffolding, config, schema
- [x] step 2 — reading pipeline
- [ ] step 3 — post generation + quality gate
- [ ] step 4 — X integration + approval queue
- [ ] step 5 — scheduler + artifact step
