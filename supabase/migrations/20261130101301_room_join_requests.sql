-- R2-13: friends-only rooms for under-16 hosts. When the admin setting "rooms.under16FriendsOnly" is on (default),
-- a Party room or friend duel hosted by a 13 to 15 player only lets in the host's accepted friends; anyone else
-- can ask to join, and the host approves or declines in the lobby.
--
-- public.room_join_requests is both the live request and the join-approval log the admin console shows (Join
-- requests page): who asked, the host, the room (kind and the code it had), the outcome and when. No chat or
-- other content, no birth dates. Rows go with either player's account (on delete cascade) and are pruned after
-- 180 days. The match link is kept only while the match exists (on delete set null); the code is a snapshot.
--
-- Access: RLS enabled and forced, and no grants to anon or authenticated. Players (the host included) read their
-- requests only through the API (/api/v1/join-requests, service role, host checked there); all writes go through
-- the API with the service role.
--
-- Rollback:
--   select cron.unschedule('spuzl-join-requests-prune');
--   drop table if exists public.room_join_requests;
--   delete from supabase_migrations.schema_migrations where version = '20261130101301';

create table if not exists public.room_join_requests (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete set null,
  room_kind text not null check (room_kind in ('duel', 'party')),
  room_code text not null check (room_code ~ '^[A-Z0-9]{4,12}$'),
  host_id uuid not null references public.players(id) on delete cascade,
  requester_id uuid not null references public.players(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (host_id <> requester_id),
  check ((status = 'pending') = (decided_at is null))
);

-- One open request per player per room; the host's pending list; the admin log, newest first.
create unique index if not exists room_join_requests_one_pending
  on public.room_join_requests (match_id, requester_id) where status = 'pending';
create index if not exists room_join_requests_match_idx on public.room_join_requests (match_id, status);
create index if not exists room_join_requests_created_idx on public.room_join_requests (created_at desc);
create index if not exists room_join_requests_host_idx on public.room_join_requests (host_id);
create index if not exists room_join_requests_requester_idx on public.room_join_requests (requester_id);

alter table public.room_join_requests enable row level security;
alter table public.room_join_requests force row level security;
revoke all on public.room_join_requests from public, anon, authenticated;

select cron.unschedule('spuzl-join-requests-prune') where exists (select 1 from cron.job where jobname = 'spuzl-join-requests-prune');
select cron.schedule('spuzl-join-requests-prune', '29 3 * * *',
  $$delete from public.room_join_requests where created_at < now() - interval '180 days'$$);
