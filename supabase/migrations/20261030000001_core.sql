-- SPUZL core schema: identity, catalogue, puzzles, attempts, ledgers.
-- Writes that affect scores, rewards or ratings go through server routes (service role) or
-- security-definer functions in the private schema. Clients read only their own rows and public views.

create extension if not exists pgcrypto;
create extension if not exists citext;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- catalogue ----------
create table public.worlds (
  id text primary key,
  name text not null,
  sort smallint not null
);

create table public.games (
  id text primary key,
  world_id text not null references public.worlds(id),
  name text not null,
  status text not null default 'live' check (status in ('live', 'coming_soon', 'hidden')),
  phase text not null check (phase in ('L', 'M2', 'M3+')),
  engine text not null,
  scoring text not null check (scoring in ('time', 'score', 'deaths')),
  is_unique boolean not null default false,
  min_time_ms integer not null default 0,
  sort smallint not null default 0
);
create index games_world_idx on public.games (world_id);

-- ---------- schools ----------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  country text,
  code text not null unique,
  verified_by uuid,
  created_at timestamptz not null default now()
);

-- ---------- players ----------
create table public.players (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname citext not null unique check (char_length(nickname) between 3 and 16 and nickname ~ '^[A-Za-z0-9_]+$'),
  age_band text not null check (age_band in ('13-15', '16-17', '18+')),
  avatar_color text not null default '#B8F23A' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  skin text,
  hat text,
  title text,
  country text check (country is null or char_length(country) = 2),
  city text,
  school_id uuid references public.schools(id) on delete set null,
  level integer not null default 1 check (level >= 1),
  xp bigint not null default 0 check (xp >= 0),
  sparks bigint not null default 0 check (sparks >= 0),
  settings jsonb not null default '{}'::jsonb,
  hide_activity boolean not null default false,
  is_guest boolean not null default true,
  banned_at timestamptz,
  ranking_revoked boolean not null default false,
  last_seen_at timestamptz,
  playing_game text references public.games(id),
  created_at timestamptz not null default now()
);
create index players_school_idx on public.players (school_id);

-- Public profile: only what leaderboards may show (SRS 11). Under-16s show nickname and avatar only.
create view public.player_cards with (security_invoker = false) as
  select p.id, p.nickname::text as nickname, p.avatar_color, p.skin, p.hat, p.title, p.level,
         case when p.age_band = '13-15' then null else p.country end as country,
         case when p.age_band = '13-15' then null else p.city end as city,
         case when p.age_band = '13-15' then null when s.verified_by is null then null else s.name end as school
  from public.players p left join public.schools s on s.id = p.school_id
  where p.banned_at is null;

-- ---------- admins ----------
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'content_editor', 'moderator', 'analyst')),
  totp_enrolled boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function private.admin_role(uid uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.admins where user_id = uid
$$;
revoke execute on function private.admin_role(uuid) from public, anon, authenticated;

-- ---------- puzzles (never readable by clients; the API strips solutions) ----------
create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  seed text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'expert', 'mega')),
  grade smallint not null default 0 check (grade between 0 and 100),
  data jsonb not null,
  solution jsonb not null,
  solution_hash text not null,
  source text not null default 'generated' check (source in ('generated', 'human')),
  status text not null default 'approved' check (status in ('draft', 'in_review', 'approved', 'scheduled', 'retired')),
  created_at timestamptz not null default now(),
  unique (game_id, seed, difficulty)
);
create index puzzles_game_status_idx on public.puzzles (game_id, status);

create table public.dailies (
  date date not null,
  game_id text not null references public.games(id),
  puzzle_id uuid not null references public.puzzles(id),
  locked boolean not null default false,
  published_at timestamptz,
  swapped_from uuid references public.puzzles(id),
  primary key (date, game_id)
);
create index dailies_puzzle_idx on public.dailies (puzzle_id);

-- ---------- attempts ----------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  game_id text not null references public.games(id),
  mode text not null check (mode in ('tutorial', 'daily', 'free', 'archive', 'duel', 'race', 'challenge')),
  daily_date date,
  puzzle_id uuid references public.puzzles(id),
  free_seed text,
  started_at timestamptz not null default now(),
  first_move_at timestamptz,
  finished_at timestamptz,
  time_ms integer check (time_ms >= 0),
  active_ms integer check (active_ms >= 0),
  hints smallint not null default 0,
  mistakes smallint not null default 0,
  deaths integer not null default 0,
  score integer,
  state jsonb,
  moves jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'cleared', 'failed', 'flagged', 'abandoned')),
  verified boolean not null default false,
  flag_reason text,
  relaxed boolean not null default false,
  offline boolean not null default false,
  ref_id uuid
);
-- One ranked attempt per game per day (SRS 12.3).
create unique index attempts_one_daily on public.attempts (player_id, game_id, daily_date) where mode = 'daily';
create index attempts_player_idx on public.attempts (player_id, started_at desc);
create index attempts_daily_board_idx on public.attempts (game_id, daily_date, status) where mode = 'daily';
create index attempts_flagged_idx on public.attempts (status) where status = 'flagged';

-- ---------- daily results (materialised for boards) ----------
create table public.daily_results (
  date date not null,
  game_id text not null references public.games(id),
  player_id uuid not null references public.players(id) on delete cascade,
  time_ms integer not null,
  score integer,
  hints smallint not null default 0,
  mistakes smallint not null default 0,
  finished_at timestamptz not null,
  rank_global integer,
  percentile numeric(5, 2),
  primary key (date, game_id, player_id)
);
create index daily_results_board_idx on public.daily_results (date, game_id, time_ms, hints, mistakes, finished_at);
create index daily_results_player_idx on public.daily_results (player_id, date desc);

-- ---------- ledgers (append-only, idempotent by source + ref) ----------
create table public.xp_ledger (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  source text not null,
  ref_id text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (player_id, source, ref_id)
);
create table public.sparks_ledger (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  source text not null,
  ref_id text not null,
  amount integer not null,
  created_at timestamptz not null default now(),
  unique (player_id, source, ref_id)
);
create index xp_ledger_player_idx on public.xp_ledger (player_id, created_at desc);
create index sparks_ledger_player_idx on public.sparks_ledger (player_id, created_at desc);

create or replace function private.forbid_mutation() returns trigger language plpgsql as $$
begin
  -- Account deletion (cascade from players) is the only allowed delete.
  if tg_op = 'DELETE' and not exists (select 1 from public.players where id = old.player_id) then
    return old;
  end if;
  raise exception 'ledger rows are append-only';
end $$;
create trigger xp_ledger_append_only before update or delete on public.xp_ledger for each row execute function private.forbid_mutation();
create trigger sparks_ledger_append_only before update or delete on public.sparks_ledger for each row execute function private.forbid_mutation();

-- Level n needs 100 × n^1.4 XP, rounded to 10 (SRS 4.2). Returns the level for a lifetime XP total.
create or replace function public.level_for_xp(total bigint)
returns integer language plpgsql immutable as $$
declare lvl integer := 1; need bigint;
begin
  loop
    need := round(100 * power(lvl, 1.4) / 10) * 10;
    exit when total < need;
    total := total - need;
    lvl := lvl + 1;
  end loop;
  return lvl;
end $$;

-- Grants XP and Sparks exactly once per (source, ref). Level-ups add 20 Sparks each.
-- Returns the applied amounts and the level change. Server-only.
create or replace function private.grant_reward(p_player uuid, p_source text, p_ref text, p_xp integer, p_sparks integer)
returns table (xp_added integer, sparks_added integer, level_before integer, level_after integer)
language plpgsql security definer set search_path = '' as $$
declare inserted boolean; lb integer; la integer; new_xp bigint;
begin
  select level into lb from public.players where id = p_player for update;
  if lb is null then raise exception 'unknown player'; end if;
  xp_added := 0; sparks_added := 0;
  if p_xp <> 0 then
    insert into public.xp_ledger (player_id, source, ref_id, amount) values (p_player, p_source, p_ref, p_xp)
      on conflict (player_id, source, ref_id) do nothing returning true into inserted;
    if inserted then xp_added := p_xp; end if;
  end if;
  inserted := null;
  if p_sparks <> 0 then
    insert into public.sparks_ledger (player_id, source, ref_id, amount) values (p_player, p_source, p_ref, p_sparks)
      on conflict (player_id, source, ref_id) do nothing returning true into inserted;
    if inserted then sparks_added := p_sparks; end if;
  end if;
  update public.players set xp = xp + xp_added, sparks = sparks + sparks_added where id = p_player returning xp into new_xp;
  la := public.level_for_xp(new_xp);
  if la > lb then
    for i in lb + 1 .. la loop
      insert into public.sparks_ledger (player_id, source, ref_id, amount) values (p_player, 'level_up', i::text, 20)
        on conflict do nothing;
      if found then update public.players set sparks = sparks + 20 where id = p_player; sparks_added := sparks_added + 20; end if;
    end loop;
    update public.players set level = la where id = p_player;
  end if;
  level_before := lb; level_after := greatest(la, lb);
  return next;
end $$;
revoke execute on function private.grant_reward(uuid, text, text, integer, integer) from public, anon, authenticated;

-- Spend Sparks atomically; fails without enough balance.
create or replace function private.spend_sparks(p_player uuid, p_source text, p_ref text, p_amount integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare bal bigint;
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  select sparks into bal from public.players where id = p_player for update;
  if bal < p_amount then raise exception 'not enough sparks' using errcode = 'P0001'; end if;
  insert into public.sparks_ledger (player_id, source, ref_id, amount) values (p_player, p_source, p_ref, -p_amount);
  update public.players set sparks = sparks - p_amount where id = p_player returning sparks into bal;
  return bal;
end $$;
revoke execute on function private.spend_sparks(uuid, text, text, integer) from public, anon, authenticated;
