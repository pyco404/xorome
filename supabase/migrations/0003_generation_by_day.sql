-- xorome: generation now means a calendar day of operation, not a single
-- session. Many sessions (8/day) share one generation; the app computes and
-- inserts it, keyed against an epoch date stored here, rather than the
-- database auto-assigning one per session.

create table if not exists agent_meta (
  key   text primary key,
  value text not null
);

alter table agent_meta enable row level security;

-- Was `generated always as identity ... unique` (1 session = 1 generation).
alter table sessions alter column generation drop identity if exists;
alter table sessions drop constraint if exists sessions_generation_key;
alter table sessions alter column generation set not null;

create index if not exists sessions_generation_idx on sessions (generation);

-- Backfill: every session so far was created today, during development —
-- all one day, all generation 1.
insert into agent_meta (key, value)
select 'epoch_date', to_char(min(started_at) at time zone 'utc', 'YYYY-MM-DD')
from sessions
on conflict (key) do nothing;

update sessions set generation = 1 where generation is distinct from 1;
update events set generation = 1 where generation is distinct from 1;
update posts set generation = 1 where generation is distinct from 1;
