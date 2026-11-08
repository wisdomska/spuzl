-- R3-06: Duel Quick Match for 13 to 15 year olds, band-only (owner decision, 8 Nov 2026). Every queue row carries the
-- player's age-band pool, written by the server from the effective band: 'u16' (13 to 15) or 'open' (16+). The server
-- only pairs inside one pool, and svc_mm_claim now refuses to claim a pair whose rows are in different pools, so an
-- adult and an under-16 can never be put in one duel even by a bug in the pairing code.
-- Existing rows are 'open' (under-16s could not queue before this). RLS stays forced; no client grants (the queue is
-- written by the service role only).
--
-- Rollback:
--   delete from public.matchmaking_queue where pool = 'u16';
--   create or replace function public.svc_mm_claim(p_players uuid[], p_match uuid) returns boolean
--   language plpgsql security definer set search_path = '' as $$
--   declare n integer;
--   begin
--     perform 1 from public.matchmaking_queue where player_id = any (p_players) and match_id is null for update skip locked;
--     get diagnostics n = row_count;
--     if n <> array_length(p_players, 1) then return false; end if;
--     update public.matchmaking_queue set match_id = p_match where player_id = any (p_players);
--     return true;
--   end $$;
--   drop index if exists public.matchmaking_queue_pool_idx;
--   alter table public.matchmaking_queue drop column if exists pool;
--   delete from supabase_migrations.schema_migrations where version = '20261207000601';

alter table public.matchmaking_queue
  add column if not exists pool text not null default 'open' check (pool in ('open', 'u16'));

create index if not exists matchmaking_queue_pool_idx on public.matchmaking_queue (pool, enqueued_at) where match_id is null;

-- Pairs queue entries atomically: every player must still be waiting and all in one pool, otherwise nothing changes.
create or replace function public.svc_mm_claim(p_players uuid[], p_match uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer; pools integer;
begin
  perform 1 from public.matchmaking_queue where player_id = any (p_players) and match_id is null for update skip locked;
  get diagnostics n = row_count;
  if n <> array_length(p_players, 1) then return false; end if;
  select count(distinct q.pool) into pools from public.matchmaking_queue q where q.player_id = any (p_players);
  if pools <> 1 then return false; end if;
  update public.matchmaking_queue set match_id = p_match where player_id = any (p_players);
  return true;
end $$;

revoke execute on function public.svc_mm_claim(uuid[], uuid) from public, anon, authenticated;
grant execute on function public.svc_mm_claim(uuid[], uuid) to service_role;
