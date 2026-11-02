-- Birth month and year (owner request: ask the age up front, keep it, apply the age rules from it).
--
-- public.players gains birth_year and birth_month (smallint, both set or both null; no day is ever stored). New
-- profiles always have them (the profile API refuses to create one without); players from before keep their
-- self-declared age_band until they add theirs once.
--
-- public.age_band_of(year, month, today) is the one age rule, mirrored by lib/age/index.ts: a player turns a year
-- older on the 1st of the month after their birth month (no day, so the careful reading); under 13 has no band
-- (null), then '13-15', '16-17', '18+'.
--
-- age_band stays a stored column, so every view, leaderboard and filter that reads it keeps working, but it is no
-- longer chosen by anyone once birth month and year are kept:
--   * trigger players_age_band (before insert, and before update of age_band, birth_year, birth_month) sets
--     age_band = age_band_of(birth_year, birth_month, today GMT) whenever birth month and year are present, and
--     refuses a birth month and year under 13 (23514 'too_young');
--   * the same trigger locks birth month and year once set (P0001 'age_locked'), except inside
--     private.admin_set_birth, which turns the lock off for its own transaction only (spuzl.age_correction);
--   * private.refresh_age_bands() (pg_cron 'spuzl-age-band-refresh', 00:03 GMT daily) moves bands up as players
--     age. Bands only change on the 1st of a month, so the stored band is right from 00:03 GMT that day; the API
--     also derives the band at read time for the signed-in player (lib/api/server.ts requirePlayer), so the
--     player's own gates never wait for the job.
-- public.svc_admin_set_birth(player, actor, year, month, reason) is the admin correction (owner and moderator,
-- checked in the API): it writes an audit row with the old and new band and the reason in the same transaction.
-- The audit row never holds the birth month or year: audit rows outlive a deleted account, birth data must not.
-- Birth month and year live only on the player row, so the account export (select * from players) includes them
-- and account deletion (cascade from auth.users) removes them.
-- RLS on players is unchanged and still forced: players read their own row (now with birth month and year) and
-- write nothing; every write goes through the API with the service role.
--
-- Rollback:
--   select cron.unschedule('spuzl-age-band-refresh') where exists (select 1 from cron.job where jobname = 'spuzl-age-band-refresh');
--   drop function if exists public.svc_admin_set_birth(uuid, uuid, integer, integer, text);
--   drop function if exists private.admin_set_birth(uuid, uuid, integer, integer, text);
--   drop function if exists private.refresh_age_bands();
--   drop trigger if exists players_age_band on public.players;
--   drop function if exists private.players_age_band();
--   drop function if exists public.age_band_of(integer, integer, date);
--   alter table public.players drop constraint if exists players_birth_pair;
--   alter table public.players drop column if exists birth_month;
--   alter table public.players drop column if exists birth_year;
--   delete from supabase_migrations.schema_migrations where version = '20261119000001';

alter table public.players
  add column if not exists birth_year smallint check (birth_year between 1900 and 2100),
  add column if not exists birth_month smallint check (birth_month between 1 and 12);
alter table public.players drop constraint if exists players_birth_pair;
alter table public.players add constraint players_birth_pair check ((birth_year is null) = (birth_month is null));

-- ---------- the age rule ----------
create or replace function public.age_band_of(p_year integer, p_month integer, p_today date)
returns text language sql immutable set search_path = '' as $$
  select case
    when p_year is null or p_month is null or p_today is null then null
    when a < 13 then null
    when a < 16 then '13-15'
    when a < 18 then '16-17'
    else '18+'
  end
  from (select extract(year from p_today)::int - p_year
               - case when extract(month from p_today)::int <= p_month then 1 else 0 end as a) x
$$;
revoke execute on function public.age_band_of(integer, integer, date) from public, anon;
grant execute on function public.age_band_of(integer, integer, date) to authenticated, service_role;

-- ---------- derive and lock ----------
create or replace function private.players_age_band() returns trigger
language plpgsql set search_path = '' as $$
declare band text;
begin
  if tg_op = 'UPDATE'
     and old.birth_year is not null
     and (new.birth_year is distinct from old.birth_year or new.birth_month is distinct from old.birth_month)
     and coalesce(current_setting('spuzl.age_correction', true), '') <> 'on' then
    raise exception 'age_locked' using errcode = 'P0001', hint = 'Birth month and year are set once; an admin can correct them.';
  end if;
  if new.birth_year is not null then
    band := public.age_band_of(new.birth_year, new.birth_month, (now() at time zone 'utc')::date);
    if band is null then raise exception 'too_young' using errcode = '23514'; end if;
    new.age_band := band;
  end if;
  return new;
end $$;
revoke execute on function private.players_age_band() from public, anon, authenticated;

drop trigger if exists players_age_band on public.players;
create trigger players_age_band before insert or update of age_band, birth_year, birth_month on public.players
  for each row execute function private.players_age_band();

-- ---------- daily refresh ----------
create or replace function private.refresh_age_bands() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.players p
     set age_band = public.age_band_of(p.birth_year, p.birth_month, (now() at time zone 'utc')::date)
   where p.birth_year is not null
     and p.age_band is distinct from public.age_band_of(p.birth_year, p.birth_month, (now() at time zone 'utc')::date);
  get diagnostics n = row_count;
  if n > 0 then insert into public.audit_log (action, detail) values ('cron.age_bands', jsonb_build_object('moved', n)); end if;
  return n;
end $$;
revoke execute on function private.refresh_age_bands() from public, anon, authenticated;

select cron.unschedule('spuzl-age-band-refresh') where exists (select 1 from cron.job where jobname = 'spuzl-age-band-refresh');
select cron.schedule('spuzl-age-band-refresh', '3 0 * * *', $$select private.refresh_age_bands()$$);

-- ---------- admin correction ----------
create or replace function private.admin_set_birth(p_player uuid, p_actor uuid, p_year integer, p_month integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare was text; now_band text;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if p_year is null or p_month is null or p_month not between 1 and 12 or p_year < 1900 then
    raise exception 'birth month and year required' using errcode = '22023';
  end if;
  if make_date(p_year, p_month, 1) > (now() at time zone 'utc')::date then
    raise exception 'birth month is in the future' using errcode = '22023';
  end if;
  now_band := public.age_band_of(p_year, p_month, (now() at time zone 'utc')::date);
  if now_band is null then
    raise exception 'under 13: delete the account instead' using errcode = '22023';
  end if;
  select age_band into was from public.players where id = p_player for update;
  if not found then raise exception 'player not found' using errcode = 'P0002'; end if;
  perform set_config('spuzl.age_correction', 'on', true);
  update public.players set birth_year = p_year, birth_month = p_month where id = p_player;
  perform set_config('spuzl.age_correction', 'off', true);
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'player.birth_correct', 'player:' || p_player,
            jsonb_build_object('from_band', was, 'to_band', now_band, 'reason', p_reason));
  return jsonb_build_object('player', p_player, 'age_band', now_band);
end $$;

create or replace function public.svc_admin_set_birth(p_player uuid, p_actor uuid, p_year integer, p_month integer, p_reason text)
returns jsonb language sql security definer set search_path = '' as $$
  select private.admin_set_birth(p_player, p_actor, p_year, p_month, p_reason) $$;

revoke execute on function private.admin_set_birth(uuid, uuid, integer, integer, text) from public, anon, authenticated;
revoke execute on function public.svc_admin_set_birth(uuid, uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.svc_admin_set_birth(uuid, uuid, integer, integer, text) to service_role;

-- Still forced (nothing here changes it; asserted by supabase/tests/108_birth_month_year.test.sql).
alter table public.players enable row level security;
alter table public.players force row level security;
