-- "Last active" now moves on any activity (opening the app, starting or finishing a game, the online heartbeat).
-- Backfill: players whose last_seen_at is empty or older than their latest game or sign-in get that time.
-- Data only, no schema change. Rollback: none needed (it only fills in times that already happened).

update public.players p
   set last_seen_at = x.latest
  from (
    select p2.id,
           greatest(
             coalesce(p2.last_seen_at, '-infinity'::timestamptz),
             coalesce((select max(a.started_at) from public.attempts a where a.player_id = p2.id), '-infinity'::timestamptz),
             coalesce((select u.last_sign_in_at from auth.users u where u.id = p2.id), '-infinity'::timestamptz)
           ) as latest
      from public.players p2
  ) x
 where x.id = p.id
   and x.latest > coalesce(p.last_seen_at, '-infinity'::timestamptz)
   and x.latest > '-infinity'::timestamptz;
