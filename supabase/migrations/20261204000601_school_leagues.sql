-- R2-P5: school and campus leagues (admin setting "features.schoolLeagues", default off until schools are seeded).
-- public.schools.kind: 'school' or 'campus' (a university or college campus). Admin-managed: created, edited and
--   verified on the admin Schools page (audited). Only verified schools can be joined or ranked.
-- public.players.school_set_at: when the player last picked a school by search (one change a week, so nobody hops
--   schools to move the table). Under-16s never join by search: only through a teacher's class code (School Cup),
--   enforced by the API.
-- public.svc_school_league(week, metric, min): the weekly school-vs-school table. Per verified school: its active
--   players that week (members with at least one verified clear; banned and test players left out), the total and
--   the average of the metric over them ('clears': verified clears; 'sparks': Sparks earned, positive ledger rows).
--   Schools with fewer than p_min active players are left out, so a small group's average never stands in for one
--   child's score. It returns school names and aggregates only, never a player.
-- Service role only; no table grants or policies change (schools keep their verified-only read policy).
-- Rollback:
--   drop function if exists public.svc_school_league(date, text, integer);
--   drop function if exists private.school_league(date, text, integer);
--   alter table public.players drop column if exists school_set_at;
--   alter table public.schools drop column if exists updated_at, drop column if exists kind;
--   delete from supabase_migrations.schema_migrations where version = '20261204000601';

alter table public.schools add column if not exists kind text not null default 'school' check (kind in ('school', 'campus'));
alter table public.schools add column if not exists updated_at timestamptz not null default now();
alter table public.players add column if not exists school_set_at timestamptz;
create index if not exists schools_verified_name_idx on public.schools (lower(name)) where verified_by is not null;
-- Clears in a week, per player: the league reads verified clears by finish time.
create index if not exists attempts_player_finished_idx on public.attempts (player_id, finished_at) where status = 'cleared';

create or replace function private.school_league(p_week date, p_metric text, p_min integer)
returns table (school_id uuid, name text, kind text, city text, country text, active integer, total bigint, average numeric)
language sql stable security definer set search_path = '' as $$
  with members as (
    select p.id, p.school_id
    from public.players p
    join public.schools s on s.id = p.school_id and s.verified_by is not null
    where p.banned_at is null and not p.is_test
  ),
  clears as (
    select a.player_id, count(*)::bigint as n
    from public.attempts a
    join members m on m.id = a.player_id
    where a.status = 'cleared' and a.verified
      and a.finished_at >= p_week::timestamptz and a.finished_at < (p_week + 7)::timestamptz
    group by a.player_id
  ),
  sparks as (
    select l.player_id, sum(l.amount)::bigint as n
    from public.sparks_ledger l
    join clears c on c.player_id = l.player_id
    where l.amount > 0 and l.created_at >= p_week::timestamptz and l.created_at < (p_week + 7)::timestamptz
    group by l.player_id
  ),
  per_school as (
    select m.school_id,
           count(*)::integer as active,
           sum(case when p_metric = 'sparks' then coalesce(sp.n, 0) else c.n end)::bigint as total
    from clears c
    join members m on m.id = c.player_id
    left join sparks sp on sp.player_id = c.player_id
    group by m.school_id
  )
  select s.id, s.name, s.kind, s.city, s.country, ps.active, ps.total, round(ps.total::numeric / ps.active, 1)
  from per_school ps
  join public.schools s on s.id = ps.school_id
  where ps.active >= greatest(p_min, 1)
  order by round(ps.total::numeric / ps.active, 1) desc, ps.active desc, s.name
$$;

create or replace function public.svc_school_league(p_week date, p_metric text, p_min integer)
returns table (school_id uuid, name text, kind text, city text, country text, active integer, total bigint, average numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_metric not in ('clears', 'sparks') then raise exception 'metric must be clears or sparks' using errcode = '22023'; end if;
  return query select * from private.school_league(p_week, p_metric, p_min);
end $$;

revoke execute on function private.school_league(date, text, integer) from public, anon, authenticated;
revoke execute on function public.svc_school_league(date, text, integer) from public, anon, authenticated;
grant execute on function public.svc_school_league(date, text, integer) to service_role;
