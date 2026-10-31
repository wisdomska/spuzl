-- Admin console (SRS FR-AD-01 to FR-AD-08).
-- Every admin read and write goes through role-checked routes under /api/admin using the service role.
-- Nothing here is readable or executable by anon or authenticated clients, admins included: the browser
-- never talks to these tables directly. Multi-step actions are security-definer functions so the action
-- and its audit row commit together.

-- ---------- admins ----------
alter table public.admins add column if not exists email citext;
alter table public.admins add column if not exists added_by uuid references auth.users(id) on delete set null;
alter table public.admins add column if not exists disabled_at timestamptz;
create unique index if not exists admins_email_idx on public.admins (email) where email is not null;

-- ---------- puzzles: review trail ----------
alter table public.puzzles add column if not exists check_report jsonb;
alter table public.puzzles add column if not exists checked_at timestamptz;
alter table public.puzzles add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.puzzles add column if not exists reviewed_at timestamptz;
alter table public.puzzles add column if not exists reviewer_note text check (reviewer_note is null or char_length(reviewer_note) <= 2000);
alter table public.puzzles add column if not exists content_item_id uuid references public.content_items(id) on delete set null;
create index if not exists puzzles_content_item_idx on public.puzzles (content_item_id) where content_item_id is not null;
create index if not exists puzzles_solution_hash_idx on public.puzzles (game_id, solution_hash);

-- ---------- dailies: lock and swap trail ----------
alter table public.dailies add column if not exists locked_at timestamptz;
alter table public.dailies add column if not exists locked_by uuid references auth.users(id) on delete set null;
alter table public.dailies add column if not exists swapped_at timestamptz;
alter table public.dailies add column if not exists swapped_by uuid references auth.users(id) on delete set null;
create index if not exists dailies_swapped_from_idx on public.dailies (swapped_from) where swapped_from is not null;

-- A locked Daily keeps its puzzle. Only the emergency swap (which sets spuzl.daily_swap for its own
-- transaction) may replace it, and a locked Daily is never deleted.
create or replace function private.guard_locked_daily() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.locked then
      raise exception 'daily % % is locked', old.game_id, old.date using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.locked and new.puzzle_id is distinct from old.puzzle_id
     and coalesce(current_setting('spuzl.daily_swap', true), '') <> 'on' then
    raise exception 'daily % % is locked', old.game_id, old.date using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists dailies_locked_guard on public.dailies;
create trigger dailies_locked_guard before update or delete on public.dailies
  for each row execute function private.guard_locked_daily();

-- ---------- content_items: editor drafts and content.ts review ----------
alter table public.content_items add column if not exists source text not null default 'editor'
  check (source in ('editor', 'content_file'));
alter table public.content_items add column if not exists source_ref text;
alter table public.content_items add column if not exists source_hash text;
alter table public.content_items add column if not exists updated_at timestamptz not null default now();
alter table public.content_items add column if not exists submitted_at timestamptz;
alter table public.content_items add column if not exists scheduled_for date;
alter table public.content_items add column if not exists puzzle_id uuid references public.puzzles(id) on delete set null;
create unique index if not exists content_items_source_ref_idx on public.content_items (source_ref) where source = 'content_file';
create index if not exists content_items_author_idx on public.content_items (author_id);
create index if not exists content_items_reviewer_idx on public.content_items (reviewer_id);
-- An approved or scheduled item always names its reviewer (the author check already forbids self-review).
alter table public.content_items drop constraint if exists content_items_approved_has_reviewer;
alter table public.content_items add constraint content_items_approved_has_reviewer
  check (status not in ('approved', 'scheduled') or reviewer_id is not null);
-- Editor items need an author; only content.ts entries (reviewed by the owner) may have none.
alter table public.content_items drop constraint if exists content_items_editor_has_author;
alter table public.content_items add constraint content_items_editor_has_author
  check (source = 'content_file' or author_id is not null);

-- ---------- players: timed bans ----------
alter table public.players add column if not exists banned_until timestamptz;
alter table public.players add column if not exists ban_reason text check (ban_reason is null or char_length(ban_reason) <= 500);

-- ---------- reports: resolution note ----------
alter table public.reports add column if not exists resolution text check (resolution is null or char_length(resolution) <= 500);
create index if not exists reports_target_idx on public.reports (target_type, target_id);

-- ---------- audit log ----------
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_action_idx on public.audit_log (action, created_at desc);

-- ---------- live ops support ----------
create index if not exists attempts_started_idx on public.attempts (started_at);
create index if not exists players_last_seen_idx on public.players (last_seen_at) where last_seen_at is not null;

-- RLS stays default-deny on everything touched here (enabled and forced in 20261030000003).
alter table public.admins enable row level security;
alter table public.admins force row level security;
revoke insert, update, delete, truncate on public.admins, public.content_items, public.audit_log, public.reports,
  public.puzzles, public.dailies, public.feature_flags from anon, authenticated;

-- ======================================================================================================
-- Security-definer actions. Each one writes its audit row in the same transaction.
-- ======================================================================================================

-- Emergency "Swap Daily" (FR-AD-07): replaces a Daily's puzzle, keeps swapped_from, retires the old one.
create or replace function private.admin_swap_daily(p_date date, p_game text, p_new uuid, p_actor uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare old_id uuid;
begin
  select puzzle_id into old_id from public.dailies where date = p_date and game_id = p_game for update;
  if old_id is null then raise exception 'no daily for % %', p_game, p_date using errcode = 'P0002'; end if;
  if old_id = p_new then raise exception 'swap needs a different puzzle' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.puzzles where id = p_new and game_id = p_game) then
    raise exception 'puzzle % is not a % puzzle', p_new, p_game using errcode = 'P0001';
  end if;
  perform set_config('spuzl.daily_swap', 'on', true);
  update public.dailies
    set puzzle_id = p_new, swapped_from = old_id, swapped_at = now(), swapped_by = p_actor,
        locked = true, locked_at = coalesce(locked_at, now()), locked_by = coalesce(locked_by, p_actor)
    where date = p_date and game_id = p_game;
  perform set_config('spuzl.daily_swap', 'off', true);
  update public.puzzles set status = 'retired' where id = old_id;
  update public.puzzles set status = 'scheduled' where id = p_new;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'daily.swap', p_game || ':' || p_date, jsonb_build_object('from', old_id, 'to', p_new, 'reason', p_reason));
  return jsonb_build_object('date', p_date, 'game', p_game, 'from', old_id, 'to', p_new);
end $$;

-- Locks every Daily from p_from through p_through (inclusive). Returns how many changed.
create or replace function private.admin_lock_dailies(p_from date, p_through date, p_actor uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with l as (
    update public.dailies set locked = true, locked_at = now(), locked_by = p_actor
    where date between p_from and p_through and not locked returning 1
  ) select count(*) into n from l;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, case when p_actor is null then 'cron.daily_autolock' else 'daily.lock' end, p_from || '..' || p_through,
            jsonb_build_object('locked', n));
  return n;
end $$;

-- Dailies inside the next 7 days are always locked (FR-AD-02). Runs after the rollover.
create or replace function private.admin_autolock() returns integer
language sql security definer set search_path = '' as $$
  select private.admin_lock_dailies((now() at time zone 'utc')::date, (now() at time zone 'utc')::date + 7, null)
$$;

-- Flagged score review (FR-AD-05, SRS 12.3): clear publishes the result to the boards, reject voids it.
create or replace function private.admin_resolve_flagged(p_attempt uuid, p_decision text, p_actor uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.attempts; revoked boolean; published boolean := false;
begin
  if p_decision not in ('clear', 'reject') then raise exception 'bad decision' using errcode = '22023'; end if;
  select * into a from public.attempts where id = p_attempt for update;
  if a.id is null then raise exception 'attempt not found' using errcode = 'P0002'; end if;
  if a.status <> 'flagged' then raise exception 'attempt is not flagged' using errcode = 'P0001'; end if;
  if p_decision = 'clear' then
    update public.attempts set status = 'cleared', verified = true where id = a.id;
    select ranking_revoked into revoked from public.players where id = a.player_id;
    if a.mode = 'daily' and a.daily_date is not null and not a.relaxed and not coalesce(revoked, false) then
      perform private.record_daily_clear(a.player_id, a.game_id, a.daily_date, a.time_ms, a.score, a.hints, a.mistakes);
      -- Past days are already ranked: re-rank so the cleared time takes its place.
      if a.daily_date < (now() at time zone 'utc')::date then perform private.rank_day(a.daily_date); end if;
      published := true;
    end if;
  else
    update public.attempts set status = 'failed', verified = false where id = a.id;
    delete from public.daily_results where player_id = a.player_id and game_id = a.game_id and date = a.daily_date;
  end if;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'flagged.' || p_decision, 'attempt:' || a.id,
            jsonb_build_object('player', a.player_id, 'game', a.game_id, 'date', a.daily_date, 'time_ms', a.time_ms,
                               'flag_reason', a.flag_reason, 'note', p_note, 'published', published));
  return jsonb_build_object('attempt', a.id, 'decision', p_decision, 'published', published);
end $$;

-- Player moderation: ban (optionally timed, optionally voiding times), unban, revoke or restore ranking, reset (void times), rename.
create or replace function private.admin_player_action(p_player uuid, p_actor uuid, p_action text, p_days integer,
  p_reason text, p_nickname text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.players; voided integer := 0;
begin
  select * into p from public.players where id = p_player for update;
  if p.id is null then raise exception 'player not found' using errcode = 'P0002'; end if;
  case p_action
    when 'ban', 'ban_void' then
      update public.players set banned_at = now(), ban_reason = p_reason,
        banned_until = case when p_days is null then null else now() + make_interval(days => p_days) end
        where id = p_player;
    when 'unban' then
      update public.players set banned_at = null, banned_until = null, ban_reason = null where id = p_player;
    when 'revoke_ranking' then
      update public.players set ranking_revoked = true where id = p_player;
    when 'restore_ranking' then
      update public.players set ranking_revoked = false where id = p_player;
    when 'reset' then
      -- Void times: the player's board entries, ratings and streak go; the account and purchases stay.
      with d as (delete from public.daily_results where player_id = p_player returning 1) select count(*) into voided from d;
      delete from public.ratings where player_id = p_player;
      update public.streaks set current = 0, best = 0, lost_value = 0, lost_on = null, updated_at = now() where player_id = p_player;
    when 'rename' then
      if p_nickname is null then raise exception 'nickname required' using errcode = '22023'; end if;
      update public.players set nickname = p_nickname where id = p_player;
    else
      raise exception 'unknown action %', p_action using errcode = '22023';
  end case;
  if p_action = 'ban_void' then
    with d as (delete from public.daily_results where player_id = p_player returning 1) select count(*) into voided from d;
  end if;
  insert into public.audit_log (actor_id, action, target, detail)
    values (p_actor, 'player.' || p_action, 'player:' || p_player,
            jsonb_strip_nulls(jsonb_build_object('days', p_days, 'reason', p_reason, 'from', case when p_action = 'rename' then p.nickname::text end,
                               'to', p_nickname, 'voided', nullif(voided, 0))));
  return jsonb_build_object('player', p_player, 'action', p_action, 'voided', voided);
end $$;

-- Timed bans lift themselves.
create or replace function private.admin_lift_bans() returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  with u as (
    update public.players set banned_at = null, banned_until = null, ban_reason = null
    where banned_until is not null and banned_until <= now() returning id
  ) select count(*) into n from u;
  if n > 0 then insert into public.audit_log (action, detail) values ('cron.ban_expiry', jsonb_build_object('lifted', n)); end if;
  return n;
end $$;

-- ======================================================================================================
-- Live ops (FR-AD-06). Test players are excluded everywhere. Days are GMT.
-- ======================================================================================================

create or replace function private.admin_kpis(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with real as (select id from public.players where not is_test),
  day_active as (
    select (a.started_at at time zone 'utc')::date as d, count(distinct a.player_id) as n
    from public.attempts a join real r on r.id = a.player_id
    where a.started_at >= (p_today - 7)::timestamp at time zone 'utc' and a.started_at < (p_today + 1)::timestamp at time zone 'utc'
    group by 1
  )
  select jsonb_build_object(
    'date', p_today,
    'players_now', (select count(*) from public.players p where not p.is_test and p.last_seen_at > now() - interval '5 minutes'),
    'dau', coalesce((select n from day_active where d = p_today), 0),
    'dau_yesterday', coalesce((select n from day_active where d = p_today - 1), 0),
    'dau_last_week', coalesce((select n from day_active where d = p_today - 7), 0),
    'clears_today', (select count(*) from public.daily_results r join real on real.id = r.player_id where r.date = p_today),
    'flagged', (select count(*) from public.attempts a where a.status = 'flagged'),
    'open_reports', (select count(*) from public.reports where status = 'open'),
    'banned', (select count(*) from public.players where banned_at is not null)
  )
$$;

create or replace function private.admin_clears_by_game(p_date date)
returns table (game_id text, clears bigint, median_ms integer, free_clears bigint)
language sql stable security definer set search_path = '' as $$
  select g.id,
    (select count(*) from public.daily_results r join public.players p on p.id = r.player_id and not p.is_test
      where r.date = p_date and r.game_id = g.id),
    (select percentile_cont(0.5) within group (order by r.time_ms)::integer from public.daily_results r
      join public.players p on p.id = r.player_id and not p.is_test where r.date = p_date and r.game_id = g.id),
    (select count(*) from public.attempts a join public.players p on p.id = a.player_id and not p.is_test
      where a.game_id = g.id and a.mode = 'free' and a.status = 'cleared'
        and a.finished_at >= p_date::timestamp at time zone 'utc' and a.finished_at < (p_date + 1)::timestamp at time zone 'utc')
  from public.games g where g.status <> 'hidden'
$$;

-- D1 and D7 retention from attempts: of the players first active on day c, the share active again on
-- c + 1 (D1) or c + 7 (D7). Pooled over the last 7 complete cohorts so one quiet day does not swing it.
create or replace function private.admin_retention(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$
  with days as (
    select a.player_id, (a.started_at at time zone 'utc')::date as d
    from public.attempts a join public.players p on p.id = a.player_id and not p.is_test
    where a.started_at >= (p_today - 30)::timestamp at time zone 'utc'
    group by 1, 2
  ),
  firsts as (
    select a.player_id, min((a.started_at at time zone 'utc')::date) as c
    from public.attempts a join public.players p on p.id = a.player_id and not p.is_test
    group by 1
  ),
  d1 as (
    select count(*) as cohort, count(*) filter (where exists (select 1 from days x where x.player_id = f.player_id and x.d = f.c + 1)) as kept
    from firsts f where f.c between p_today - 8 and p_today - 2
  ),
  d7 as (
    select count(*) as cohort, count(*) filter (where exists (select 1 from days x where x.player_id = f.player_id and x.d = f.c + 7)) as kept
    from firsts f where f.c between p_today - 14 and p_today - 8
  )
  select jsonb_build_object(
    'd1', case when d1.cohort > 0 then round(100.0 * d1.kept / d1.cohort, 1) end, 'd1_cohort', d1.cohort,
    'd7', case when d7.cohort > 0 then round(100.0 * d7.kept / d7.cohort, 1) end, 'd7_cohort', d7.cohort)
  from d1, d7
$$;

create or replace function private.admin_streak_distribution()
returns table (bucket text, sort smallint, players bigint)
language sql stable security definer set search_path = '' as $$
  with b(bucket, sort, lo, hi) as (values ('0', 0, 0, 0), ('1', 1, 1, 1), ('2 to 6', 2, 2, 6), ('7 to 13', 3, 7, 13),
    ('14 to 29', 4, 14, 29), ('30 to 99', 5, 30, 99), ('100+', 6, 100, 2147483647))
  select b.bucket, b.sort::smallint,
    (select count(*) from public.streaks s join public.players p on p.id = s.player_id and not p.is_test
      where s.current between b.lo and b.hi)
  from b order by b.sort
$$;

-- Players who started an attempt in each 30 minute slot of the last 24 hours (48 slots, oldest first).
create or replace function private.admin_activity_series(p_now timestamptz)
returns table (slot_start timestamptz, players bigint)
language sql stable security definer set search_path = '' as $$
  with slots as (
    select date_bin('30 minutes', p_now, timestamptz '2000-01-01') - make_interval(mins => 30 * k) as s
    from generate_series(0, 47) k
  )
  select s.s, (select count(distinct a.player_id) from public.attempts a join public.players p on p.id = a.player_id and not p.is_test
               where a.started_at >= s.s and a.started_at < s.s + interval '30 minutes')
  from slots s order by s.s
$$;

-- ---------- service-role entry points (PostgREST exposes public only) ----------
create or replace function public.svc_admin_swap_daily(p_date date, p_game text, p_new uuid, p_actor uuid, p_reason text) returns jsonb
language sql security definer set search_path = '' as $$ select private.admin_swap_daily(p_date, p_game, p_new, p_actor, p_reason) $$;
create or replace function public.svc_admin_lock_dailies(p_from date, p_through date, p_actor uuid) returns integer
language sql security definer set search_path = '' as $$ select private.admin_lock_dailies(p_from, p_through, p_actor) $$;
create or replace function public.svc_admin_resolve_flagged(p_attempt uuid, p_decision text, p_actor uuid, p_note text) returns jsonb
language sql security definer set search_path = '' as $$ select private.admin_resolve_flagged(p_attempt, p_decision, p_actor, p_note) $$;
create or replace function public.svc_admin_player_action(p_player uuid, p_actor uuid, p_action text, p_days integer, p_reason text, p_nickname text)
returns jsonb language sql security definer set search_path = '' as $$
  select private.admin_player_action(p_player, p_actor, p_action, p_days, p_reason, p_nickname) $$;
create or replace function public.svc_admin_kpis(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.admin_kpis(p_today) $$;
create or replace function public.svc_admin_clears_by_game(p_date date)
returns table (game_id text, clears bigint, median_ms integer, free_clears bigint)
language sql stable security definer set search_path = '' as $$ select * from private.admin_clears_by_game(p_date) $$;
create or replace function public.svc_admin_retention(p_today date) returns jsonb
language sql stable security definer set search_path = '' as $$ select private.admin_retention(p_today) $$;
create or replace function public.svc_admin_streak_distribution() returns table (bucket text, sort smallint, players bigint)
language sql stable security definer set search_path = '' as $$ select * from private.admin_streak_distribution() $$;
create or replace function public.svc_admin_activity_series(p_now timestamptz) returns table (slot_start timestamptz, players bigint)
language sql stable security definer set search_path = '' as $$ select * from private.admin_activity_series(p_now) $$;

revoke execute on function
  private.guard_locked_daily(), private.admin_swap_daily(date, text, uuid, uuid, text), private.admin_lock_dailies(date, date, uuid),
  private.admin_autolock(), private.admin_resolve_flagged(uuid, text, uuid, text),
  private.admin_player_action(uuid, uuid, text, integer, text, text), private.admin_lift_bans(), private.admin_kpis(date),
  private.admin_clears_by_game(date), private.admin_retention(date), private.admin_streak_distribution(),
  private.admin_activity_series(timestamptz)
  from public, anon, authenticated;
revoke execute on function
  public.svc_admin_swap_daily(date, text, uuid, uuid, text), public.svc_admin_lock_dailies(date, date, uuid),
  public.svc_admin_resolve_flagged(uuid, text, uuid, text), public.svc_admin_player_action(uuid, uuid, text, integer, text, text),
  public.svc_admin_kpis(date), public.svc_admin_clears_by_game(date), public.svc_admin_retention(date),
  public.svc_admin_streak_distribution(), public.svc_admin_activity_series(timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.svc_admin_swap_daily(date, text, uuid, uuid, text), public.svc_admin_lock_dailies(date, date, uuid),
  public.svc_admin_resolve_flagged(uuid, text, uuid, text), public.svc_admin_player_action(uuid, uuid, text, integer, text, text),
  public.svc_admin_kpis(date), public.svc_admin_clears_by_game(date), public.svc_admin_retention(date),
  public.svc_admin_streak_distribution(), public.svc_admin_activity_series(timestamptz)
  to service_role;

-- Schedules (GMT): lock the coming week after the 00:00 rollover; lift timed bans hourly.
select cron.schedule('spuzl-admin-autolock', '10 0 * * *', $$select private.admin_autolock()$$);
select cron.schedule('spuzl-admin-lift-bans', '7 * * * *', $$select private.admin_lift_bans()$$);
