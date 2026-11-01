-- 18+ party games: Draw It and Two Truths (admin setting "features.adultParty", off by default).
-- Only signed-in 18+ players may create, join or see these rooms; the app server enforces that on every call.
--
-- What this adds:
--   matches.party_mode      'race' (Party Race, any age), 'draw' (Draw It) or 'truths' (Two Truths)
--   matches.party_leads     the starting line-up: who draws or writes in each round
--   match_players.kicked_at a host removed this player; they can't rejoin the room
--   players.adult_notice_at when the player confirmed the "Adults only" notice (asked once, before hosting)
--   players.adult_party_blocked_until  set when a moderator actions a party-content report
--   reports.snapshot        the reported content as it was (text, statements or strokes); target_type 'party'
--   party_rounds / party_guesses / party_votes  one room's live round state. Free text and strokes are wiped
--     when the round closes (only reports keep a copy) and every row goes with its room (on delete cascade),
--     which the daily rollover already prunes.
--   svc_party_strokes       appends, undoes or clears strokes for the round's drawer, within the caps.
-- All new tables: RLS enabled and forced, no client policies, no client grants (server only). Nothing here
-- changes existing rows.
--
-- Rollback (one transaction):
--   drop function if exists public.svc_party_strokes(uuid, smallint, smallint, uuid, text, jsonb, integer, integer);
--   drop table if exists public.party_votes, public.party_guesses, public.party_rounds;
--   delete from public.matches where party_mode <> 'race';
--   alter table public.matches drop column if exists party_leads, drop column if exists party_mode;
--   alter table public.match_players drop column if exists kicked_at;
--   alter table public.players drop column if exists adult_party_blocked_until, drop column if exists adult_notice_at;
--   delete from public.reports where target_type = 'party';
--   alter table public.reports drop constraint if exists reports_target_type_check;
--   alter table public.reports add constraint reports_target_type_check
--     check (target_type in ('player', 'nickname', 'crew', 'score', 'content'));
--   alter table public.reports drop column if exists snapshot;
--   delete from supabase_migrations.schema_migrations where version = '20261112000001';

-- ---------- rooms ----------
alter table public.matches
  add column if not exists party_mode text not null default 'race' check (party_mode in ('race', 'draw', 'truths')),
  add column if not exists party_leads uuid[] not null default '{}' check (cardinality(party_leads) <= 8);
alter table public.matches add constraint matches_adult_party_room
  check (party_mode = 'race' or (kind = 'race' and classroom = false and game_id is null));

alter table public.match_players add column if not exists kicked_at timestamptz;

alter table public.players
  add column if not exists adult_notice_at timestamptz,
  add column if not exists adult_party_blocked_until timestamptz;

-- ---------- reports: party content with a snapshot ----------
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('player', 'nickname', 'crew', 'score', 'content', 'party'));
alter table public.reports add column if not exists snapshot jsonb
  check (snapshot is null or (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 262144));

-- ---------- live round state (server only) ----------
create table public.party_rounds (
  match_id uuid not null references public.matches(id) on delete cascade,
  set_no smallint not null,
  round smallint not null check (round between 1 and 8),
  mode text not null check (mode in ('draw', 'truths')),
  lead_id uuid references public.players(id) on delete set null,
  -- Draw It: the secret word (from the app's word list, never typed by a player)
  word text check (word is null or char_length(word) <= 40),
  -- Two Truths: three statements (80 characters each, checked by the app) and the lie's index
  statements text[] check (statements is null or (cardinality(statements) = 3 and char_length(array_to_string(statements, '')) <= 240)),
  lie smallint check (lie is null or lie between 0 and 2),
  strokes jsonb not null default '[]'::jsonb check (jsonb_typeof(strokes) = 'array' and pg_column_size(strokes) <= 262144),
  phase text not null check (phase in ('write', 'play', 'reveal', 'done')),
  started_at timestamptz not null,
  phase_ends_at timestamptz not null,
  -- points per player for this round, fixed when the round closes
  awards jsonb check (awards is null or jsonb_typeof(awards) = 'object'),
  created_at timestamptz not null default now(),
  primary key (match_id, set_no, round)
);
create index party_rounds_lead_idx on public.party_rounds (lead_id);

create table public.party_guesses (
  id bigint generated always as identity primary key,
  match_id uuid not null,
  set_no smallint not null,
  round smallint not null,
  player_id uuid not null references public.players(id) on delete cascade,
  -- shown to the room while the round runs; null for correct or giveaway guesses and once the round closes
  text text check (text is null or char_length(text) <= 30),
  correct boolean not null default false,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  created_at timestamptz not null default now(),
  foreign key (match_id, set_no, round) references public.party_rounds (match_id, set_no, round) on delete cascade
);
create index party_guesses_round_idx on public.party_guesses (match_id, set_no, round, id);
create index party_guesses_player_idx on public.party_guesses (player_id);
create unique index party_guesses_correct_once on public.party_guesses (match_id, set_no, round, player_id) where correct;

create table public.party_votes (
  match_id uuid not null,
  set_no smallint not null,
  round smallint not null,
  player_id uuid not null references public.players(id) on delete cascade,
  pick smallint not null check (pick between 0 and 2),
  created_at timestamptz not null default now(),
  primary key (match_id, set_no, round, player_id),
  foreign key (match_id, set_no, round) references public.party_rounds (match_id, set_no, round) on delete cascade
);
create index party_votes_player_idx on public.party_votes (player_id);

alter table public.party_rounds enable row level security;
alter table public.party_rounds force row level security;
alter table public.party_guesses enable row level security;
alter table public.party_guesses force row level security;
alter table public.party_votes enable row level security;
alter table public.party_votes force row level security;
-- No policies: clients never read these (the secret word lives here); the server builds each player's view.
revoke all on public.party_rounds, public.party_guesses, public.party_votes from anon, authenticated;

-- ---------- strokes ----------
-- Only the round's drawer, only while the round is drawing and on time, and only within the caps.
-- p_op: 'add' appends p_strokes (p_new_points points in them), 'undo' drops the last stroke, 'clear' empties.
-- Returns the drawing's stroke count, or null when nothing changed.
create or replace function public.svc_party_strokes(
  p_match uuid, p_set smallint, p_round smallint, p_player uuid, p_op text, p_strokes jsonb,
  p_max_strokes integer, p_max_points integer
) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if p_op not in ('add', 'undo', 'clear') then return null; end if;
  if p_op = 'add' and (p_strokes is null or jsonb_typeof(p_strokes) <> 'array') then return null; end if;
  update public.party_rounds r
     set strokes = case p_op
                     when 'add' then r.strokes || p_strokes
                     when 'undo' then r.strokes - (-1)
                     else '[]'::jsonb
                   end
   where r.match_id = p_match and r.set_no = p_set and r.round = p_round
     and r.mode = 'draw' and r.phase = 'play' and r.lead_id = p_player and r.phase_ends_at > now()
     and (p_op <> 'add' or (
       jsonb_array_length(r.strokes) + jsonb_array_length(p_strokes) <= p_max_strokes
       and (select coalesce(sum(jsonb_array_length(e -> 'p')), 0) from jsonb_array_elements(r.strokes || p_strokes) e) <= p_max_points * 2
     ))
  returning jsonb_array_length(r.strokes) into n;
  return n;
end $$;
revoke execute on function public.svc_party_strokes(uuid, smallint, smallint, uuid, text, jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.svc_party_strokes(uuid, smallint, smallint, uuid, text, jsonb, integer, integer) to service_role;
