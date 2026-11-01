-- Admin Players (owner request: view and manage guests and signed-in players).
--
-- public.svc_admin_players(filters, sort, dir, limit, offset, with_email) returns one page of the player list as
-- {total, rows}: account type from auth identities (guest, email, google), age band, level and XP, Sparks, streak,
-- last active, joined, ban and ranking state, flagged scores and reports received. Sorting is an allow-list of
-- column keys (anything else raises 22023); every filter is a bound parameter. The email is returned only when
-- with_email is true (roles allowed to see personal data); otherwise a masked form (j•••@•••.com). City, country
-- and school are never returned.
-- public.svc_admin_player_overview(today) gives the admin home totals (test players excluded).
-- public.svc_admin_grant_sparks / svc_admin_grant_freeze / svc_admin_revoke_sessions are the new player actions;
-- each writes its audit row in the same transaction and requires a reason. Sparks moves are bounded to ±10,000 and
-- never leave a negative balance. Revoking sessions deletes the user's auth sessions (their refresh tokens go with
-- them), which is what GoTrue's own sign-out does: the admin API's signOut needs the user's JWT, which the server
-- does not hold. Access tokens already issued lapse at their expiry (one hour at most).
-- No new tables, so no RLS changes; every function is service role only.
--
-- Rollback:
--   drop function if exists public.svc_admin_players(jsonb, text, text, integer, integer, boolean);
--   drop function if exists public.svc_admin_player_overview(date);
--   drop function if exists public.svc_admin_grant_sparks(uuid, uuid, integer, text);
--   drop function if exists public.svc_admin_grant_freeze(uuid, uuid, text);
--   drop function if exists public.svc_admin_revoke_sessions(uuid, uuid, text);
--   drop function if exists private.admin_players(jsonb, text, text, integer, integer, boolean);
--   drop function if exists private.admin_player_overview(date);
--   drop function if exists private.admin_grant_sparks(uuid, uuid, integer, text);
--   drop function if exists private.admin_grant_freeze(uuid, uuid, text);
--   drop function if exists private.admin_revoke_sessions(uuid, uuid, text);
--   drop function if exists private.player_account_type(uuid);
--   drop function if exists private.mask_email(text);
--   drop index if exists public.attempts_player_flagged_idx;
--   drop index if exists public.audit_log_target_idx;
--   drop index if exists public.players_sparks_idx;
--   drop index if exists public.players_xp_idx;
--   drop index if exists public.streaks_current_idx;
--   delete from supabase_migrations.schema_migrations where version = '20261113000001';

-- ---------- indexes for the list's sorts, filters and the detail page ----------
create index if not exists attempts_player_flagged_idx on public.attempts (player_id) where status = 'flagged';
create index if not exists audit_log_target_idx on public.audit_log (target, id desc) where target is not null;
create index if not exists players_sparks_idx on public.players (sparks);
create index if not exists players_xp_idx on public.players (xp);
create index if not exists streaks_current_idx on public.streaks (current);

-- ---------- helpers ----------
-- How the player signs in: google if a Google identity is linked, email for a non-anonymous account with an email,
-- guest otherwise (anonymous sign-in).
create or replace function private.player_account_type(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from auth.identities i where i.user_id = p_user and i.provider = 'google') then 'google'
    when exists (select 1 from auth.users u where u.id = p_user and not coalesce(u.is_anonymous, false)
                 and (u.email is not null or exists (select 1 from auth.identities i where i.user_id = p_user and i.provider = 'email')))
      then 'email'
    else 'guest'
  end
$$;

-- "jane.doe@gmail.com" -> "j•••@•••.com". Null stays null.
create or replace function private.mask_email(p_email text) returns text
language sql immutable set search_path = '' as $$
  select case when p_email is null or position('@' in p_email) = 0 then null
    else left(p_email, 1) || '•••@•••' || coalesce(substring(split_part(p_email, '@', 2) from '\.[^.]+$'), '') end
$$;

-- ---------- the player list ----------
create or replace function private.admin_players(p_filters jsonb, p_sort text, p_dir text, p_limit integer, p_offset integer,
  p_with_email boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare ord text; res jsonb;
begin
  ord := case p_sort
    when 'joined' then 'b.created_at'
    when 'nickname' then 'lower(b.nickname)'
    when 'account' then 'b.account_type'
    when 'age_band' then 'b.age_band'
    when 'level' then 'b.xp'
    when 'sparks' then 'b.sparks'
    when 'streak' then 'b.streak'
    when 'last_active' then 'b.last_active'
    when 'reports' then 'b.reports_open'
  end;
  if ord is null then raise exception 'bad sort %', p_sort using errcode = '22023'; end if;
  if p_dir is null or p_dir not in ('asc', 'desc') then raise exception 'bad dir' using errcode = '22023'; end if;
  if p_limit is null or p_limit not between 1 and 10000 or p_offset is null or p_offset < 0 then
    raise exception 'bad page' using errcode = '22023';
  end if;
  -- ord and p_dir come from the fixed lists above; every filter value is a bound parameter ($1).
  execute format($q$
    with b as materialized (
      select p.id, p.nickname::text as nickname, private.player_account_type(p.id) as account_type,
        coalesce((select array_agg(distinct i.provider order by i.provider) from auth.identities i where i.user_id = p.id), '{}') as providers,
        u.email::text as email_raw, p.age_band, p.level, p.xp, p.sparks,
        coalesce(s.current, 0) as streak, coalesce(s.best, 0) as best_streak, coalesce(s.freezes_held, 0) as freezes,
        p.last_seen_at as last_active, p.created_at, p.banned_at, p.banned_until, p.ranking_revoked, p.is_test,
        (select count(*) from public.attempts a where a.player_id = p.id and a.status = 'flagged')::int as flagged,
        (select count(*) from public.reports r where r.target_type in ('player', 'nickname') and r.target_id = p.id::text
           and r.status = 'open')::int as reports_open,
        (select count(*) from public.reports r where r.target_type in ('player', 'nickname') and r.target_id = p.id::text)::int as reports_total
      from public.players p
      left join auth.users u on u.id = p.id
      left join public.streaks s on s.player_id = p.id
      where
        case coalesce($1->>'test', 'exclude') when 'only' then p.is_test when 'include' then true else not p.is_test end
        and ($1->>'age' is null or p.age_band = $1->>'age')
        and ($1->>'joined_from' is null or p.created_at >= ($1->>'joined_from')::date::timestamp at time zone 'utc')
        and ($1->>'joined_to' is null or p.created_at < (($1->>'joined_to')::date + 1)::timestamp at time zone 'utc')
        and ($1->>'active_from' is null or p.last_seen_at >= ($1->>'active_from')::date::timestamp at time zone 'utc')
        and ($1->>'active_to' is null or p.last_seen_at < (($1->>'active_to')::date + 1)::timestamp at time zone 'utc')
        and ($1->>'q' is null or case coalesce($1->>'q_kind', 'nickname')
              when 'id' then p.id::text = lower($1->>'q')
              when 'email' then lower(u.email) = lower($1->>'q')
              else p.nickname::text ilike '%%' || replace(replace(replace($1->>'q', '\', '\\'), '%%', '\%%'), '_', '\_') || '%%'
            end)
    ),
    f as materialized (
      select * from b
      where ($1->>'account' is null or b.account_type = $1->>'account')
        and case coalesce($1->>'status', '')
              when 'active' then b.banned_at is null and not b.ranking_revoked and b.flagged = 0
              when 'banned' then b.banned_at is not null
              when 'ranking_revoked' then b.ranking_revoked
              when 'flagged' then b.flagged > 0
              else true end
        and case coalesce($1->>'reports', '')
              when 'any' then b.reports_total > 0
              when 'open' then b.reports_open > 0
              when 'none' then b.reports_total = 0
              else true end
    ),
    pg as (
      select b.*, row_number() over (order by %1$s %2$s nulls last, b.id %2$s) as rn
      from f as b order by rn limit $3 offset $4
    )
    select jsonb_build_object(
      'total', (select count(*) from f),
      'rows', coalesce((select jsonb_agg(
                 (to_jsonb(pg) - 'email_raw' - 'rn')
                 || jsonb_build_object('email', case when $2 then pg.email_raw else private.mask_email(pg.email_raw) end)
                 order by pg.rn) from pg), '[]'::jsonb))
  $q$, ord, p_dir)
  into res
  using coalesce(p_filters, '{}'::jsonb), coalesce(p_with_email, false), p_limit, p_offset;
  return res;
end $$;

-- ---------- admin home totals ----------
create or replace function private.admin_player_overview(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with real as (
    select p.id, p.age_band, p.created_at, p.last_seen_at, p.banned_at, p.ranking_revoked, private.player_account_type(p.id) as account
    from public.players p where not p.is_test
  ),
  t as (select p_today::timestamp at time zone 'utc' as today, (p_today - 6)::timestamp at time zone 'utc' as week)
  select jsonb_build_object(
    'date', p_today,
    'players', (select count(*) from real),
    'guests', (select count(*) from real where account = 'guest'),
    'signed_in', (select count(*) from real where account <> 'guest'),
    'by_method', jsonb_build_object(
      'guest', (select count(*) from real where account = 'guest'),
      'email', (select count(*) from real where account = 'email'),
      'google', (select count(*) from real where account = 'google')),
    'by_age', jsonb_build_object(
      '13-15', (select count(*) from real where age_band = '13-15'),
      '16-17', (select count(*) from real where age_band = '16-17'),
      '18+', (select count(*) from real where age_band = '18+')),
    'new_today', (select count(*) from real, t where created_at >= t.today),
    'new_7d', (select count(*) from real, t where created_at >= t.week),
    'active_today', (select count(*) from real, t where last_seen_at >= t.today),
    'active_7d', (select count(*) from real, t where last_seen_at >= t.week),
    'banned', (select count(*) from real where banned_at is not null),
    'ranking_revoked', (select count(*) from real where ranking_revoked)
  )
$$;

-- ---------- actions (each audited in the same transaction) ----------
create or replace function private.admin_grant_sparks(p_player uuid, p_actor uuid, p_amount integer, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare bal bigint;
begin
  if p_amount is null or p_amount = 0 or p_amount not between -10000 and 10000 then
    raise exception 'amount must be between -10000 and 10000 and not 0' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  select sparks into bal from public.players where id = p_player for update;
  if bal is null then raise exception 'player not found' using errcode = 'P0002'; end if;
  if bal + p_amount < 0 then raise exception 'not enough sparks' using errcode = 'P0001'; end if;
  insert into public.sparks_ledger (player_id, source, ref_id, amount) values (p_player, 'admin', gen_random_uuid()::text, p_amount);
  update public.players set sparks = sparks + p_amount where id = p_player;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'player.sparks', 'player:' || p_player,
            jsonb_build_object('amount', p_amount, 'before', bal, 'after', bal + p_amount, 'reason', p_reason));
  return jsonb_build_object('player', p_player, 'before', bal, 'after', bal + p_amount);
end $$;

create or replace function private.admin_grant_freeze(p_player uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare held smallint;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players where id = p_player) then
    raise exception 'player not found' using errcode = 'P0002';
  end if;
  insert into public.streaks (player_id) values (p_player) on conflict (player_id) do nothing;
  select freezes_held into held from public.streaks where player_id = p_player for update;
  if held >= 2 then raise exception 'freeze_full' using errcode = 'P0001'; end if;
  update public.streaks set freezes_held = freezes_held + 1, updated_at = now() where player_id = p_player;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'player.freeze', 'player:' || p_player, jsonb_build_object('held', held + 1, 'reason', p_reason));
  return jsonb_build_object('player', p_player, 'freezes', held + 1);
end $$;

create or replace function private.admin_revoke_sessions(p_player uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.players where id = p_player) then
    raise exception 'player not found' using errcode = 'P0002';
  end if;
  with d as (delete from auth.sessions where user_id = p_player returning 1) select count(*) into n from d;
  delete from auth.refresh_tokens where user_id = p_player::text;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'player.signout', 'player:' || p_player, jsonb_build_object('sessions', n, 'reason', p_reason));
  return jsonb_build_object('player', p_player, 'sessions', n);
end $$;

-- ---------- service-role entry points ----------
create or replace function public.svc_admin_players(p_filters jsonb, p_sort text, p_dir text, p_limit integer, p_offset integer,
  p_with_email boolean) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.admin_players(p_filters, p_sort, p_dir, p_limit, p_offset, p_with_email) $$;
create or replace function public.svc_admin_player_overview(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.admin_player_overview(p_today) $$;
create or replace function public.svc_admin_grant_sparks(p_player uuid, p_actor uuid, p_amount integer, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$ select private.admin_grant_sparks(p_player, p_actor, p_amount, p_reason) $$;
create or replace function public.svc_admin_grant_freeze(p_player uuid, p_actor uuid, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$ select private.admin_grant_freeze(p_player, p_actor, p_reason) $$;
create or replace function public.svc_admin_revoke_sessions(p_player uuid, p_actor uuid, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$ select private.admin_revoke_sessions(p_player, p_actor, p_reason) $$;

revoke execute on function
  private.player_account_type(uuid), private.mask_email(text),
  private.admin_players(jsonb, text, text, integer, integer, boolean), private.admin_player_overview(date),
  private.admin_grant_sparks(uuid, uuid, integer, text), private.admin_grant_freeze(uuid, uuid, text),
  private.admin_revoke_sessions(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function
  public.svc_admin_players(jsonb, text, text, integer, integer, boolean), public.svc_admin_player_overview(date),
  public.svc_admin_grant_sparks(uuid, uuid, integer, text), public.svc_admin_grant_freeze(uuid, uuid, text),
  public.svc_admin_revoke_sessions(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.svc_admin_players(jsonb, text, text, integer, integer, boolean), public.svc_admin_player_overview(date),
  public.svc_admin_grant_sparks(uuid, uuid, integer, text), public.svc_admin_grant_freeze(uuid, uuid, text),
  public.svc_admin_revoke_sessions(uuid, uuid, text)
  to service_role;
