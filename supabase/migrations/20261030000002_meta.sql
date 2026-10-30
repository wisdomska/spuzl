-- Progression, social, multiplayer and ops.

-- ---------- streaks ----------
create table public.streaks (
  player_id uuid primary key references public.players(id) on delete cascade,
  current integer not null default 0 check (current >= 0),
  best integer not null default 0 check (best >= 0),
  last_clear_date date,
  freezes_held smallint not null default 0 check (freezes_held between 0 and 2),
  lost_value integer not null default 0,
  lost_on date,
  repair_progress smallint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- ratings (Glicko-2 per world, plus duel) ----------
create table public.ratings (
  player_id uuid not null references public.players(id) on delete cascade,
  track text not null, -- world id, or 'duel', or 'board:<game>'
  rating numeric(7, 2) not null default 1000,
  rd numeric(6, 2) not null default 350,
  vol numeric(8, 6) not null default 0.06,
  games integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (player_id, track)
);
create index ratings_track_idx on public.ratings (track, rating desc);

-- ---------- badges ----------
create table public.badges (
  id text primary key,
  family text not null,
  tier text not null check (tier in ('bronze', 'silver', 'gold', 'prism')),
  name text not null,
  description text not null,
  secret boolean not null default false,
  sparks integer not null default 10,
  rule jsonb not null default '{}'::jsonb,
  sort smallint not null default 0
);
create table public.player_badges (
  player_id uuid not null references public.players(id) on delete cascade,
  badge_id text not null references public.badges(id),
  earned_at timestamptz not null default now(),
  seen boolean not null default false,
  primary key (player_id, badge_id)
);

-- ---------- quests ----------
create table public.quests (
  id text primary key,
  kind text not null check (kind in ('daily', 'weekly')),
  title text not null,
  goal jsonb not null,
  xp integer not null default 30,
  sparks integer not null default 10,
  step smallint,
  active boolean not null default true
);
create table public.player_quests (
  player_id uuid not null references public.players(id) on delete cascade,
  quest_id text not null references public.quests(id),
  period date not null, -- day for daily quests, week start (Monday) for weekly
  progress integer not null default 0,
  target integer not null,
  completed_at timestamptz,
  claimed_at timestamptz,
  primary key (player_id, quest_id, period)
);

-- ---------- leagues ----------
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  tier smallint not null check (tier between 0 and 4), -- Bronze Block .. Cosmic Spuz
  week_start date not null,
  finalised_at timestamptz
);
create index leagues_week_idx on public.leagues (week_start, tier);
create table public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points integer not null default 0,
  final_rank smallint,
  result text check (result in ('promoted', 'stayed', 'demoted')),
  ceremony_seen boolean not null default false,
  primary key (league_id, player_id)
);
create index league_members_player_idx on public.league_members (player_id);

-- ---------- shop ----------
create table public.cosmetics (
  id text primary key,
  type text not null check (type in ('skin', 'hat', 'board_theme', 'title', 'frame', 'freeze', 'hint_pack')),
  name text not null,
  price_sparks integer not null check (price_sparks >= 0),
  rarity text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  payload jsonb not null default '{}'::jsonb,
  unlock_level integer,
  active boolean not null default true,
  sort smallint not null default 0
);
create table public.inventory (
  player_id uuid not null references public.players(id) on delete cascade,
  cosmetic_id text not null references public.cosmetics(id),
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (player_id, cosmetic_id)
);

-- ---------- social ----------
create table public.friendships (
  player_id uuid not null references public.players(id) on delete cascade,
  friend_id uuid not null references public.players(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (player_id, friend_id),
  check (player_id <> friend_id)
);
create index friendships_friend_idx on public.friendships (friend_id);
create table public.blocks (
  player_id uuid not null references public.players(id) on delete cascade,
  blocked_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (player_id, blocked_id)
);
create table public.invites (
  code text primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 24),
  color text not null default '#B8F23A',
  owner_id uuid not null references public.players(id) on delete cascade,
  join_code text not null unique,
  created_at timestamptz not null default now()
);
create table public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  player_id uuid not null unique references public.players(id) on delete cascade,
  role text not null default 'member' check (role in ('captain', 'member')),
  joined_at timestamptz not null default now(),
  primary key (crew_id, player_id)
);
create table public.crew_clashes (
  id uuid primary key default gen_random_uuid(),
  crew_a uuid not null references public.crews(id) on delete cascade,
  crew_b uuid not null references public.crews(id) on delete cascade,
  week_start date not null,
  score_a integer not null default 0,
  score_b integer not null default 0,
  winner uuid references public.crews(id)
);

create table public.feed_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players(id) on delete cascade,
  kind text not null check (kind in ('clear', 'full_spuzl', 'badge', 'level', 'streak', 'duel_win', 'party_win', 'promotion')),
  game_id text references public.games(id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index feed_events_player_idx on public.feed_events (player_id, created_at desc);
-- Preset reactions only (FR-SO-04): no free text anywhere in social.
create table public.reactions (
  event_id bigint not null references public.feed_events(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  reaction text not null check (reaction in ('fire', 'lol', 'gg', 'wow', 'clap')),
  created_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.players(id) on delete cascade,
  target_type text not null check (target_type in ('player', 'nickname', 'crew', 'score', 'content')),
  target_id text not null,
  reason text not null check (reason in ('nickname', 'cheating', 'harassment', 'spam', 'other')),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index reports_status_idx on public.reports (status, created_at);

-- ---------- multiplayer ----------
-- Duels and Party Races share one table. Server decides every result.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('duel', 'race')),
  code text unique, -- room code for races: 4 chars, no 0 O 1 I
  host_id uuid references public.players(id) on delete set null,
  game_id text references public.games(id), -- null = random mix
  mix boolean not null default false,
  status text not null default 'lobby' check (status in ('queue', 'lobby', 'countdown', 'playing', 'round_end', 'finished', 'abandoned')),
  round smallint not null default 1,
  best_of smallint not null default 3,
  puzzle_seeds text[] not null default '{}',
  round_started_at timestamptz,
  region text,
  is_bot boolean not null default false,
  winner_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  emptied_at timestamptz,
  finished_at timestamptz
);
create index matches_status_idx on public.matches (status, created_at);
create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  ready boolean not null default false,
  rounds_won smallint not null default 0,
  progress numeric(4, 3) not null default 0,
  mistakes smallint not null default 0,
  finished_ms integer,
  place smallint,
  left_at timestamptz,
  last_seen_at timestamptz not null default now(),
  rating_before numeric(7, 2),
  rating_after numeric(7, 2),
  primary key (match_id, player_id)
);
create index match_players_player_idx on public.match_players (player_id);

create table public.matchmaking_queue (
  player_id uuid primary key references public.players(id) on delete cascade,
  game_id text not null references public.games(id),
  rating numeric(7, 2) not null,
  region text,
  enqueued_at timestamptz not null default now()
);
create index matchmaking_queue_game_idx on public.matchmaking_queue (game_id, rating);

-- Board Bay live and async games
create table public.board_matches (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) check (game_id in ('chess', 'draughts', 'oware', 'ludo', 'fourup', 'flip')),
  mode text not null check (mode in ('live', 'async')),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'finished', 'abandoned')),
  players uuid[] not null,
  turn smallint not null default 0,
  state jsonb not null,
  move_deadline timestamptz,
  nudged_at timestamptz,
  result text,
  winner_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_matches_players_idx on public.board_matches using gin (players);
create index board_matches_deadline_idx on public.board_matches (move_deadline) where status = 'active';
create table public.board_moves (
  match_id uuid not null references public.board_matches(id) on delete cascade,
  ply integer not null,
  player_id uuid not null references public.players(id) on delete cascade,
  move jsonb not null,
  created_at timestamptz not null default now(),
  primary key (match_id, ply)
);

-- Async challenge: a link to an exact puzzle and the sender's time
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  sender_id uuid not null references public.players(id) on delete cascade,
  game_id text not null references public.games(id),
  puzzle_id uuid references public.puzzles(id),
  free_seed text,
  difficulty text,
  sender_ms integer not null,
  sender_timeline jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create table public.challenge_results (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  time_ms integer not null,
  won boolean not null,
  created_at timestamptz not null default now(),
  primary key (challenge_id, player_id)
);

-- Ghost runs (Rage Ridge replays)
create table public.ghost_runs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  game_id text not null references public.games(id),
  daily_date date,
  time_ms integer not null,
  deaths integer not null default 0,
  inputs jsonb not null,
  created_at timestamptz not null default now()
);
create index ghost_runs_lookup_idx on public.ghost_runs (game_id, daily_date, player_id);

-- School Cup
create table public.school_cups (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.players(id) on delete cascade,
  class_name text not null,
  games text[] not null,
  week_start date not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);
create table public.school_cup_members (
  cup_id uuid not null references public.school_cups(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  points integer not null default 0,
  primary key (cup_id, player_id)
);

-- ---------- ops ----------
create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  payload jsonb not null,
  author_id uuid references auth.users(id),
  reviewer_id uuid references auth.users(id),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'approved', 'rejected', 'scheduled')),
  needs_owner_review boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (reviewer_id is null or reviewer_id <> author_id) -- two-person approval
);
create index content_items_status_idx on public.content_items (game_id, status);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function private.forbid_any() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;
create trigger audit_log_append_only before update or delete on public.audit_log for each row execute function private.forbid_any();
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.rate_limits (
  key text primary key,
  count integer not null,
  window_start timestamptz not null
);
