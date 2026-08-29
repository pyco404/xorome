-- xorome: posts.event_ids integrity
-- run this once in the Supabase SQL editor, after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- fix: posts_event_ids_not_empty was checking array_length(event_ids, 1) > 0.
-- array_length() returns NULL (not 0) for an empty array, and a NULL check
-- expression passes rather than fails a CHECK constraint in postgres — so an
-- empty event_ids array was silently accepted. cardinality() returns 0 for
-- an empty array and has none of this NULL behavior.
-- ---------------------------------------------------------------------------

alter table posts drop constraint if exists posts_event_ids_not_empty;
alter table posts add constraint posts_event_ids_not_empty
  check (cardinality(event_ids) > 0);

-- ---------------------------------------------------------------------------
-- every id in posts.event_ids must reference a real row in events. this is
-- the core claim of the project — nothing gets posted that isn't backed by
-- a logged event — so it's enforced in the database, not just in app code.
-- ---------------------------------------------------------------------------

create or replace function posts_event_ids_must_exist()
returns trigger as $$
declare
  missing_id uuid;
begin
  select e_id into missing_id
  from unnest(new.event_ids) as e_id
  where not exists (select 1 from events where events.id = e_id)
  limit 1;

  if missing_id is not null then
    raise exception 'posts.event_ids references nonexistent event %', missing_id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists posts_event_ids_must_exist_trigger on posts;
create trigger posts_event_ids_must_exist_trigger
  before insert or update on posts
  for each row
  execute function posts_event_ids_must_exist();
