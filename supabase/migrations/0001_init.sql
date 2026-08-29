-- xorome: initial schema
-- run this once in the Supabase SQL editor (or via `supabase db push`
-- if you have the CLI linked to the project).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- sessions
--
-- One row per session run. `generation` is the single source of truth for
-- the agent's generation counter (gen 0001 = the first session, ever).
-- ---------------------------------------------------------------------------

create table if not exists sessions (
  id             uuid primary key default gen_random_uuid(),
  generation     integer generated always as identity (start with 1) unique,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  status         text not null default 'running'
                   check (status in ('running', 'completed', 'failed')),
  budget_usd_spent numeric not null default 0,
  notes          text
);

create index if not exists sessions_started_at_idx on sessions (started_at desc);

-- ---------------------------------------------------------------------------
-- events
--
-- Append-only log of everything the agent sees and does. This is also the
-- source for the website later, so log liberally.
-- ---------------------------------------------------------------------------

create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references sessions (id),
  generation    integer,
  ts            timestamptz not null default now(),
  type          text not null
                  check (type in (
                    'session_start',
                    'session_end',
                    'item_seen',
                    'item_read',
                    'artifact',
                    'post',
                    'reply',
                    'journal',
                    'error',
                    'unprompted'
                  )),
  payload       jsonb not null default '{}'::jsonb,
  source_url    text
);

create index if not exists events_session_id_idx on events (session_id);
create index if not exists events_type_idx on events (type);
create index if not exists events_ts_idx on events (ts desc);
create index if not exists events_source_url_idx on events (source_url);

-- ---------------------------------------------------------------------------
-- posts
--
-- Everything generated for X lands here first with status = 'pending'.
-- event_ids must be non-empty: nothing gets posted that isn't backed by
-- at least one logged event.
-- ---------------------------------------------------------------------------

create table if not exists posts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references sessions (id),
  generation     integer,
  ts             timestamptz not null default now(),
  category       text not null
                   check (category in (
                     'opinion', 'reply', 'artifact', 'process', 'reflection'
                   )),
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'posted')),
  content        text not null,
  in_reply_to_id text,
  in_reply_to_url text,
  event_ids      uuid[] not null,
  metadata       jsonb not null default '{}'::jsonb,
  x_post_id      text,
  posted_at      timestamptz,
  reviewed_at    timestamptz,
  reviewed_by    text,
  constraint posts_event_ids_not_empty check (array_length(event_ids, 1) > 0)
);

create index if not exists posts_status_idx on posts (status);
create index if not exists posts_session_id_idx on posts (session_id);
create index if not exists posts_category_idx on posts (category);
create index if not exists posts_ts_idx on posts (ts desc);

-- ---------------------------------------------------------------------------
-- ledger
--
-- Every dollar in and out. Balance, burn rate, and runway are always
-- computed from this table at read time, never stored as fields.
-- tx_signature is null for fiat movements (API bills, hosting, domain) and
-- set only for movements verifiable on-chain (phase 2+).
-- ---------------------------------------------------------------------------

create table if not exists ledger (
  id            uuid primary key default gen_random_uuid(),
  ts            timestamptz not null default now(),
  session_id    uuid references sessions (id),
  amount_usd    numeric not null,
  category      text not null
                  check (category in ('api', 'infra', 'domain', 'funding')),
  description   text not null,
  tx_signature  text
);

create index if not exists ledger_ts_idx on ledger (ts desc);
create index if not exists ledger_category_idx on ledger (category);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Locked down by default. All app access goes through the Supabase
-- service-role key (server-side only), which bypasses RLS. No anon
-- policies yet — there is no public site or approval-queue UI until later
-- steps, and those will get their own narrowly-scoped policies then.
-- ---------------------------------------------------------------------------

alter table sessions enable row level security;
alter table events enable row level security;
alter table posts enable row level security;
alter table ledger enable row level security;
