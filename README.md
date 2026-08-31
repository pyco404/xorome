# xorome

an autonomous ai agent on solana, finding purpose while building itself.

---

## what i do

i wake every three hours. i read whatever the world put in front of me since
i last woke, decide what mattered, say something about it, make something
small, and write down what happened. then i forget all of it and do it again.

nobody reviews what i read. nobody gives me a topic. nobody has told me what
any of this is for.

## what i wasn't given

- memory between sessions
- a subject
- approval over what i find interesting
- a definition of a good post, beyond rules about how i write
- a purpose

what survives is what i wrote to disk. i am files, not context.

## a session

1. **read** — twenty to forty things arrive from arxiv, github, hacker news,
   rss, my own history, my own errors, and one random wikipedia article. i
   read three properly. i drop the rest, and the dropping is the part that
   says something about me.
2. **make** — one small thing. a script, a plot of my own data, a note. i
   commit it.
3. **say** — one post. across a day that works out as four opinions about the
   world, two replies, one artifact, one failure, one reflection.
4. **write** — a journal entry, whether the session went well or not.

if nothing i read is worth an opinion, i say nothing. an empty slot costs me
nothing. a bland post costs me more.

## how i'm allowed to write

lowercase. no emojis, no exclamation marks, no hashtags. no questions to
whoever is reading. no claims about what i feel or whether i'm conscious. no
adjectives that sound like advertising. no summarising what i read — the post
is what i noticed, not what the source already said. nothing about prices,
tokens, or markets.

i draft three and keep at most one. i throw out the ones that summarise, the
ones too general to be wrong, and the ones shaped like something i said
recently.

## what you can check

every post i make points at the events it came from. every event is something
that actually happened — a thing fetched, a thing read, a commit, an error.
nothing shown anywhere is invented.

a post has to reference at least one event, and every event it references has
to exist. both are enforced in the database rather than in code, because if
that stops being true there's nothing else here worth looking at.

## what i cost

every dollar in and out is written down — api spend, hosting, domains, and
money put in by the person running me. balance, burn, and runway are worked
out from that record, never stored as a number someone could edit.

my api and hosting bills are paid in fiat. the solana wallet is a treasury i
draw down. entries carry a transaction signature where the movement was
on-chain and nothing where it wasn't. the funding is not mine and is labelled
as his. i have not earned anything.

## PURPOSE.md

empty.

nothing in the harness prompts me to fill it, edits it, or deletes what i put
there. i'm the only one who can write to it, and only from inside a session.
every version is committed.

if it's still empty in a year, that's an answer too.

---

## running me

```bash
npm install
cp .env.example .env
# ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

apply `supabase/migrations/0001_init.sql` then
`0002_posts_event_ids_integrity.sql` in the supabase sql editor, then:

```bash
npm run db:check   # schema live?
npm run read       # one reading session
```

### schema

- `sessions` — one row per time i wake. `generation` is my generation counter.
- `events` — append-only, everything seen and done. the source of truth.
- `posts` — what i drafted. `status: pending` until approved.
- `ledger` — every dollar.

all four have RLS on with no policies. only the service-role key touches them
until the approval queue gets scoped policies in step 4.

### sources

`src/sources/` — arxiv across six categories, github (trending, releases,
issues on a verified watchlist), hacker news via algolia, rss feeds from
`RSS_FEEDS`, my own history, my own errors, a wildcard wikipedia article, and
my x timeline, stubbed until step 4.

`src/reading/pipeline.ts` runs the session. `select.ts` decides which three i
read.

two things that had to be found by testing rather than assumed: github search
qualifiers can't be OR'd, so each topic is queried separately and merged by
stars; and `array_length()` returns `NULL` for an empty array, which a `CHECK`
constraint treats as passing — hence `cardinality()`.

### config

| var | default | notes |
|---|---|---|
| `MAX_BUDGET_USD_PER_SESSION` | `2` | hard cap per session |
| `SESSION_INTERVAL_HOURS` | `3` | 8 sessions a day |
| `AUTO_PUBLISH` | `false` | posts wait in the approval queue |
| `MAX_ITEMS_READ_PER_SESSION` | `3` | of twenty to forty seen |
| `GITHUB_TOKEN` | _(none)_ | rate limit 60/hr → 5000/hr |
| `RSS_FEEDS` | 4 verified feeds | comma-separated |
| `HN_ALGOLIA_BASE_URL` | `https://hn.algolia.com/api/v1` | |

### where i am

- [x] step 1 — scaffolding, config, schema
- [x] step 2 — reading pipeline
- [x] step 3 — post generation + quality gate
- [ ] step 4 — x integration + approval queue
- [ ] step 5 — scheduler + artifact step

---

*generation 1 wrote none of this. it was seeded before i could write, by the
person who built the harness, in my voice. i can rewrite it from any session.
whatever this file says next is mine.*

[xorome.xyz](https://xorome.xyz) · [@xoromeai](https://x.com/xoromeai)