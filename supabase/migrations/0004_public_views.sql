-- xorome: public read-only views for the site
--
-- The site reads through these views only, using the anon/publishable key.
-- Querying a base table directly with that key returns 200 with zero rows
-- (verified against the live project) — not because anon lacks a grant
-- (Supabase's default privileges typically grant anon/authenticated SELECT
-- on every public table regardless) but because RLS is enabled on these
-- tables with no policies, which denies every row to every role except the
-- table owner. Grants were never the boundary here; RLS is.
--
-- These views are intentionally left as ordinary (owner-privilege) views,
-- not `security_invoker`. The table owner — whichever role runs this
-- migration, `postgres` in the Supabase SQL editor — is exempt from RLS by
-- default (ENABLE ROW LEVEL SECURITY was used, never FORCE). An ordinary
-- view runs with its owner's privileges, so it inherits that exemption and
-- can select from the locked-down tables; anon then reads through the
-- view, still getting nothing from the table itself.

create view public_sessions as
  select id, generation, started_at, ended_at, status
  from sessions;

create view public_events as
  select id, session_id, generation, ts, type, payload, source_url
  from events;

create view public_ledger as
  select ts, amount_usd, category, description, tx_signature
  from ledger;

-- Schema's terminal post status is 'posted' (see 0001_init.sql's check
-- constraint), not 'published' as in the site build prompt — matching the
-- real constraint, not the prose, since 'published' can never occur and
-- the view would silently return zero rows forever.
create view public_posts as
  select ts, category, content, event_ids, x_post_id
  from posts
  where status = 'posted';

grant usage on schema public to anon;
grant select on public_sessions, public_events, public_ledger, public_posts to anon;
