-- Chat in Duels and Parties: short messages per match, written only by the server (it checks membership, age and
-- the text filter) and read back through the API; realtime only pings devices to fetch. Kept 7 days.
--
-- Rollback:
--   select cron.unschedule('spuzl-match-chat-prune');
--   drop function if exists public.svc_prune_match_messages();
--   drop table if exists public.match_messages;
--   delete from supabase_migrations.schema_migrations where version = '20261124000001';

create table if not exists public.match_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  -- 'text' typed by the player (16+ rooms only), 'quick' one of the preset phrases (lib/multiplayer/chat)
  kind text not null check (kind in ('text', 'quick')),
  body text not null check (char_length(body) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists match_messages_match_idx on public.match_messages (match_id, id);
create index if not exists match_messages_created_idx on public.match_messages (created_at);

alter table public.match_messages enable row level security;
alter table public.match_messages force row level security;
revoke all on public.match_messages from anon, authenticated;
grant all on public.match_messages to service_role;

-- Old chat goes after a week (nightly).
create or replace function public.svc_prune_match_messages() returns integer
language sql security definer set search_path = '' as $$
  with gone as (delete from public.match_messages where created_at < now() - interval '7 days' returning 1)
  select count(*)::int from gone;
$$;
revoke execute on function public.svc_prune_match_messages() from public, anon, authenticated;
grant execute on function public.svc_prune_match_messages() to service_role;

select cron.unschedule('spuzl-match-chat-prune') where exists (select 1 from cron.job where jobname = 'spuzl-match-chat-prune');
select cron.schedule('spuzl-match-chat-prune', '41 3 * * *', $$select public.svc_prune_match_messages()$$);
