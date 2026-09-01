-- xorome: instrument the quality gate
--
-- Adds 'post_candidate' as a valid events.type so every candidate a
-- session generates gets logged — not just the winner — with its
-- mechanical-gate result and the judge's per-candidate verdict and reason.
-- Needed to compute a veto rate and read rejected text; without this a
-- too-strict judge is indistinguishable from thin material.

alter table events drop constraint if exists events_type_check;
alter table events add constraint events_type_check
  check (type in (
    'session_start',
    'session_end',
    'item_seen',
    'item_read',
    'artifact',
    'post',
    'post_candidate',
    'reply',
    'journal',
    'error',
    'unprompted'
  ));
