-- Live-message usage estimate (owner, 13 Nov 2026): the admin Overview shows how much of the Supabase free plan's
-- Realtime allowance (2 million messages a month) the app has used. Supabase's API does not expose that number, so
-- the app counts what it sends itself: every server broadcast (lib/realtime/server.ts) adds 1 plus one delivery per
-- player in that room, batched per server instance (lib/realtime/usage.ts). Messages that players' devices send
-- directly (chat, emotes, presence) are not counted, so the figure reads a little low.
--
-- Server-only: RLS forced, no client policies or grants. Only the service role adds (svc_add_realtime_usage) and
-- only the admin API reads.
--
-- Rollback:
--   drop function if exists public.svc_add_realtime_usage(date, bigint);
--   drop table if exists public.realtime_usage;

create table public.realtime_usage (
  day date primary key,
  messages bigint not null default 0 check (messages >= 0)
);

alter table public.realtime_usage enable row level security;
alter table public.realtime_usage force row level security;
revoke all on public.realtime_usage from anon, authenticated;

create or replace function public.svc_add_realtime_usage(p_day date, p_n bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.realtime_usage (day, messages) values (p_day, greatest(p_n, 0))
  on conflict (day) do update set messages = public.realtime_usage.messages + greatest(excluded.messages, 0);
$$;

revoke all on function public.svc_add_realtime_usage(date, bigint) from public, anon, authenticated;
grant execute on function public.svc_add_realtime_usage(date, bigint) to service_role;
