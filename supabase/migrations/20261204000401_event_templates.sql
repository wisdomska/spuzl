-- R2-P5: ready-made seasonal event templates (Detty December, Exam Season, AFCON Week, 6 March Quiz).
-- public.events.draft: an event made from a template starts as a draft and never runs (the player API's active
--   event lookup skips drafts, so no banner, no quest, no progress) until the admin schedules it from the Seasonal
--   events page (POST /api/admin/events/<id>/schedule, audited). Existing events stay scheduled (default false).
-- public.events.quiz: a Quickfire quiz set the event features while live (lib/events EVENT_QUIZZES and
--   games/quickfire/sets.ts); 'ghana-1957' is the 20 Ghana history questions of the 6 March Quiz.
-- public.events.template: which template an event came from (for the admin list), or null.
-- No grants or policies change: events stay service-role only (RLS forced, no client grants).
-- Rollback:
--   drop index if exists public.events_live_idx;
--   alter table public.events drop column if exists template, drop column if exists quiz, drop column if exists draft;
--   delete from supabase_migrations.schema_migrations where version = '20261204000401';

alter table public.events add column if not exists draft boolean not null default false;
alter table public.events add column if not exists quiz text check (quiz in ('ghana-1957'));
alter table public.events add column if not exists template text
  check (template in ('detty-december', 'exam-season', 'afcon-week', 'march-sixth'));

-- Active-event lookup skips drafts: starts_at <= now() < ends_at among scheduled events, latest start wins.
create index if not exists events_live_idx on public.events (starts_at desc, ends_at) where not draft;
