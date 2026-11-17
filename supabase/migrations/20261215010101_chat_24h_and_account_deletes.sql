-- Owner, 17 Nov 2026: "room chat can be cleared 24 hours after" and "always clear test accounts, whether admin or
-- user, after using them".
--
-- 1. Room chat (Duel, Party and board game rooms: match_messages) is kept 24 hours, not 7 days. The prune runs
--    every hour, so no line outlives 25 hours.
-- 2. Any account can be deleted, admins too. Rows that only name who last touched something (who handled a report,
--    reviewed content, changed a feature flag) keep the row and forget the person (on delete set null).
--    Two keep the person as a plain id with no foreign key instead, like content_reviews: the audit log (append-only,
--    so a cascade could never change it) and a content item's author (an editor's item must name its author,
--    content_items_editor_has_author, and the question stays in the game after its author leaves).
--
-- Rollback:
--   select cron.unschedule('spuzl-match-chat-prune');
--   create or replace function public.svc_prune_match_messages() returns integer language sql security definer
--     set search_path = '' as $f$ with gone as (delete from public.match_messages
--     where created_at < now() - interval '7 days' returning 1) select count(*)::int from gone; $f$;
--   select cron.schedule('spuzl-match-chat-prune', '41 3 * * *', $c$select public.svc_prune_match_messages()$c$);
--   (the foreign keys: re-add each without "on delete set null"; audit_log_actor_id_fkey only once no entry names a
--   deleted account)
--   delete from supabase_migrations.schema_migrations where version = '20261215010101';

create or replace function public.svc_prune_match_messages() returns integer
language sql security definer set search_path = '' as $$
  with gone as (delete from public.match_messages where created_at < now() - interval '24 hours' returning 1)
  select count(*)::int from gone;
$$;
revoke execute on function public.svc_prune_match_messages() from public, anon, authenticated;
grant execute on function public.svc_prune_match_messages() to service_role;

select cron.unschedule('spuzl-match-chat-prune') where exists (select 1 from cron.job where jobname = 'spuzl-match-chat-prune');
select cron.schedule('spuzl-match-chat-prune', '17 * * * *', $$select public.svc_prune_match_messages()$$);
-- Older chat goes now, not at the next run.
select public.svc_prune_match_messages();

alter table public.audit_log drop constraint if exists audit_log_actor_id_fkey;

alter table public.reports drop constraint if exists reports_handled_by_fkey;
alter table public.reports add constraint reports_handled_by_fkey
  foreign key (handled_by) references auth.users (id) on delete set null;

alter table public.content_items drop constraint if exists content_items_author_id_fkey;

alter table public.content_items drop constraint if exists content_items_reviewer_id_fkey;
alter table public.content_items add constraint content_items_reviewer_id_fkey
  foreign key (reviewer_id) references auth.users (id) on delete set null;

alter table public.feature_flags drop constraint if exists feature_flags_updated_by_fkey;
alter table public.feature_flags add constraint feature_flags_updated_by_fkey
  foreign key (updated_by) references auth.users (id) on delete set null;
