-- The owner regrouped the 29 live games from 8 worlds into 4 broad ones (lib/catalog.ts ALL_WORLDS). The groups
-- reuse the ids of the worlds they grew from, so /world URLs, rating tracks and badge ids stay put:
--   logic  "Puzzles"       = Logic Lab + weave, flowline, pairup, lost (Line Lane) + trotro (Shape Shed)
--   word   "Words & Quiz"  = Word Woods + quickfire, emojihits (Clue Cave)
--   reflex "Arcade"        = Reflex Rink + gotcha, dash, gauntlet (Rage Ridge)
--   board  "Board Games"   = Board Bay
-- Line Lane, Shape Shed, Clue Cave and Rage Ridge keep their rows and their retired games (foreign key, old
-- results) and join Number Den as hidden worlds: the app hides a world with no live game.
--
-- What changes:
--   worlds: new names for the 4 groups; sort puts them first (Home map order), the hidden worlds after.
--   games.world_id: the 10 live games above move. Retired games keep their old world.
--   ratings (Glicko-2 per world): a player with a rating in a folded world and none yet in its group gets it
--     copied into the group (the one with most games when there are two, e.g. line and shape). Nothing is deleted
--     or overwritten; the old track rows stay as history (the app reads live worlds only).
--   events: a seasonal bonus quest set on a folded world now counts clears in its group.
--   badges: the 4 Explorer badges take their group's name, description and icon ("Clear every game in Puzzles").
--     The Explorer badges of the hidden worlds stay (no earned row is touched); the app hides them unless earned.
--     Untouched (secret, zero deaths) now names the action courses, which left Rage Ridge.
--   quests: world quests name their group; the weekly worlds step asks for 4 worlds (there are no longer 5).
-- Every row the copy and the event update touch is recorded in private.world_regroup_undo (forced RLS, no
-- policies, service role only), so the rollback below restores exactly what was there.
--
-- Rollback:
--   update public.events e set quest = jsonb_set(e.quest, '{world}', to_jsonb(u.old_world))
--     from private.world_regroup_undo u where u.kind = 'event' and u.event_id = e.id;
--   delete from public.ratings r using private.world_regroup_undo u
--     where u.kind = 'rating' and r.player_id = u.player_id and r.track = u.track;
--   drop table private.world_regroup_undo;
--   update public.games set world_id = 'line' where id in ('weave', 'flowline', 'pairup', 'lost');
--   update public.games set world_id = 'shape' where id = 'trotro';
--   update public.games set world_id = 'clue' where id in ('quickfire', 'emojihits');
--   update public.games set world_id = 'rage' where id in ('gotcha', 'dash', 'gauntlet');
--   update public.worlds w set name = v.name, sort = v.sort from (values
--     ('logic', 'Logic Lab', 0), ('line', 'Line Lane', 1), ('shape', 'Shape Shed', 2), ('number', 'Number Den', 3),
--     ('word', 'Word Woods', 4), ('clue', 'Clue Cave', 5), ('reflex', 'Reflex Rink', 6), ('rage', 'Rage Ridge', 7),
--     ('board', 'Board Bay', 8)) as v(id, name, sort) where w.id = v.id;
--   update public.badges b set name = v.name, description = v.description, rule = b.rule || jsonb_build_object('icon', v.icon),
--     sort = v.sort from (values
--     ('explorer-logic', 'Logic Lab Explorer', 'Clear every game in Logic Lab.', 'flask', 1),
--     ('explorer-line', 'Line Lane Explorer', 'Clear every game in Line Lane.', 'path', 2),
--     ('explorer-shape', 'Shape Shed Explorer', 'Clear every game in Shape Shed.', 'cube', 3),
--     ('explorer-number', 'Number Den Explorer', 'Clear every game in Number Den.', 'hash', 4),
--     ('explorer-word', 'Word Woods Explorer', 'Clear every game in Word Woods.', 'tree', 5),
--     ('explorer-clue', 'Clue Cave Explorer', 'Clear every game in Clue Cave.', 'magnifying-glass', 6),
--     ('explorer-reflex', 'Reflex Rink Explorer', 'Clear every game in Reflex Rink.', 'lightning', 7),
--     ('explorer-rage', 'Rage Ridge Explorer', 'Clear every game in Rage Ridge.', 'fire', 8),
--     ('explorer-board', 'Board Bay Explorer', 'Clear every game in Board Bay.', 'horse', 9))
--     as v(id, name, description, icon, sort) where b.id = v.id;
--   update public.badges set description = 'Clear a Rage Ridge course with zero deaths.' where id = 'secret-pacifist';
--   update public.quests q set title = v.title, goal = v.goal::jsonb from (values
--     ('d-clear-2-word', 'Clear 2 Word Woods games', '{"kind":"world_clears","world":"word","n":2}'),
--     ('d-clear-2-logic', 'Clear 2 Logic Lab games', '{"kind":"world_clears","world":"logic","n":2}'),
--     ('d-board', 'Clear a Board Bay puzzle', '{"kind":"world_clears","world":"board","n":1}'),
--     ('w-3', 'Clear games in 5 worlds', '{"kind":"worlds_week","n":5}')) as v(id, title, goal) where q.id = v.id;
--   delete from supabase_migrations.schema_migrations where version = '20261121000001';

-- ---------- undo log ----------
create table private.world_regroup_undo (
  kind text not null check (kind in ('rating', 'event')),
  player_id uuid,
  track text,
  event_id uuid,
  old_world text,
  check ((kind = 'rating' and player_id is not null and track is not null) or (kind = 'event' and event_id is not null))
);
alter table private.world_regroup_undo enable row level security;
alter table private.world_regroup_undo force row level security;
revoke all on private.world_regroup_undo from public, anon, authenticated;

-- ---------- worlds ----------
-- Fresh databases run migrations before the seed (worlds are empty then): these updates touch nothing there and
-- the seed (scripts/gen-seed.ts) writes the same values.
update public.worlds w
set name = v.name, sort = v.sort
from (values
  ('logic', 'Puzzles', 0),
  ('word', 'Words & Quiz', 1),
  ('reflex', 'Arcade', 2),
  ('board', 'Board Games', 3),
  ('line', 'Line Lane', 4),
  ('shape', 'Shape Shed', 5),
  ('number', 'Number Den', 6),
  ('clue', 'Clue Cave', 7),
  ('rage', 'Rage Ridge', 8)
) as v(id, name, sort)
where w.id = v.id;

-- ---------- games ----------
update public.games set world_id = 'logic' where id in ('weave', 'flowline', 'pairup', 'lost', 'trotro');
update public.games set world_id = 'word' where id in ('quickfire', 'emojihits');
update public.games set world_id = 'reflex' where id in ('gotcha', 'dash', 'gauntlet');

-- ---------- ratings ----------
with folded(source, target) as (
  values ('line', 'logic'), ('shape', 'logic'), ('clue', 'word'), ('rage', 'reflex')
),
best as (
  select distinct on (r.player_id, f.target)
    r.player_id, f.target as track, r.rating, r.rd, r.vol, r.games, r.updated_at
  from public.ratings r
  join folded f on f.source = r.track
  where r.games > 0
  order by r.player_id, f.target, r.games desc, r.updated_at desc
),
copied as (
  insert into public.ratings (player_id, track, rating, rd, vol, games, updated_at)
  select player_id, track, rating, rd, vol, games, updated_at from best
  on conflict (player_id, track) do nothing
  returning player_id, track
)
insert into private.world_regroup_undo (kind, player_id, track)
select 'rating', player_id, track from copied;

-- ---------- seasonal events ----------
with folded(source, target) as (
  values ('line', 'logic'), ('shape', 'logic'), ('clue', 'word'), ('rage', 'reflex')
),
moved as (
  update public.events e
  set quest = jsonb_set(e.quest, '{world}', to_jsonb(f.target)), updated_at = now()
  from folded f
  where e.quest ->> 'world' = f.source
  returning e.id, f.source
)
insert into private.world_regroup_undo (kind, event_id, old_world)
select 'event', id, source from moved;

-- ---------- badges ----------
-- Fresh databases have no badge rows yet; the seed writes the same values.
update public.badges b
set name = v.name, description = v.description, rule = b.rule || jsonb_build_object('icon', v.icon), sort = v.sort
from (values
  ('explorer-logic', 'Puzzles Explorer', 'Clear every game in Puzzles.', 'puzzle-piece', 1),
  ('explorer-word', 'Words & Quiz Explorer', 'Clear every game in Words & Quiz.', 'chat-circle-text', 2),
  ('explorer-reflex', 'Arcade Explorer', 'Clear every game in Arcade.', 'game-controller', 3),
  ('explorer-board', 'Board Games Explorer', 'Clear every game in Board Games.', 'horse', 4),
  ('explorer-line', 'Line Lane Explorer', 'Clear every game in Line Lane.', 'path', 5),
  ('explorer-shape', 'Shape Shed Explorer', 'Clear every game in Shape Shed.', 'cube', 6),
  ('explorer-number', 'Number Den Explorer', 'Clear every game in Number Den.', 'hash', 7),
  ('explorer-clue', 'Clue Cave Explorer', 'Clear every game in Clue Cave.', 'magnifying-glass', 8),
  ('explorer-rage', 'Rage Ridge Explorer', 'Clear every game in Rage Ridge.', 'fire', 9)
) as v(id, name, description, icon, sort)
where b.id = v.id;

update public.badges set description = 'Clear a Gotcha, Dash or Gauntlet course with zero deaths.' where id = 'secret-pacifist';

-- ---------- quests ----------
-- World quests name their group; the weekly "worlds" step asks for all 4 worlds (5 of 4 could never be met).
-- player_quests rows are untouched: their target is rewritten from the code on the next progress.
update public.quests q
set title = v.title, goal = v.goal::jsonb
from (values
  ('d-clear-2-word', 'Clear 2 games in Words & Quiz', '{"kind":"world_clears","world":"word","n":2}'),
  ('d-clear-2-logic', 'Clear 2 games in Puzzles', '{"kind":"world_clears","world":"logic","n":2}'),
  ('d-board', 'Clear a Board Games puzzle', '{"kind":"world_clears","world":"board","n":1}'),
  ('w-3', 'Clear games in all 4 worlds', '{"kind":"worlds_week","n":4}')
) as v(id, title, goal)
where q.id = v.id;
