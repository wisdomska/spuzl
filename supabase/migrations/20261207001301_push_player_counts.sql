-- Round 3 item 13: distinct players for the admin Overview's push alert tiles. The Overview already counts devices
-- (push_subscriptions rows: devices with alerts on, and devices a push reached in the last 30 days); this adds the
-- same two numbers per player: players with at least one device with alerts on, and players a push reached (at least
-- one of their devices) since a given time. Test players are left out, as on every Overview number.
--
-- What this adds (no tables, no data changes):
--   private.admin_push_players(since)      the two counts as jsonb { players_on, players_reached }
--   public.svc_admin_push_players(since)   the service-role entry point the admin API calls
-- Counts only: no endpoint, key or player id leaves the database. Execute is revoked from public, anon and
-- authenticated and granted to service_role only.
--
-- Rollback:
--   drop function if exists public.svc_admin_push_players(timestamptz);
--   drop function if exists private.admin_push_players(timestamptz);
--   delete from supabase_migrations.schema_migrations where version = '20261207001301';

create or replace function private.admin_push_players(p_since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'players_on', count(distinct s.player_id),
    'players_reached', count(distinct s.player_id) filter (where s.last_ok_at >= p_since)
  )
  from public.push_subscriptions s
  join public.players p on p.id = s.player_id
  where not p.is_test
$$;

create or replace function public.svc_admin_push_players(p_since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.admin_push_players(p_since) $$;

revoke execute on function private.admin_push_players(timestamptz) from public, anon, authenticated;
revoke execute on function public.svc_admin_push_players(timestamptz) from public, anon, authenticated;
grant execute on function public.svc_admin_push_players(timestamptz) to service_role;
