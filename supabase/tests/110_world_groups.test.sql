begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Migration 20261121000001 plus the seed: the 29 live games (Quads back in R2-14) sit in 4 groups; the other worlds keep their rows and
-- only retired games.
select set_eq(
  $$select distinct world_id from public.games where status = 'live'$$,
  array['logic', 'word', 'reflex', 'board'],
  'live games sit in the 4 groups'
);
select results_eq(
  $$select w.id, w.name, count(g.id)::int from public.worlds w join public.games g on g.world_id = w.id and g.status = 'live'
    group by w.id, w.name, w.sort order by w.sort$$,
  $$values ('logic', 'Puzzles', 9), ('word', 'Words & Quiz', 9), ('reflex', 'Arcade', 6), ('board', 'Board Games', 5)$$,
  'groups in Home map order with their live game counts'
);
select is((select count(*)::int from public.worlds), 9, 'the folded worlds keep their rows');
select is(
  (select count(*)::int from public.games where world_id in ('line', 'shape', 'number', 'clue', 'rage') and status = 'live'),
  0,
  'the folded worlds hold no live game'
);
select is((select count(*)::int from public.games where world_id = 'rage' and status = 'retired'), 7, 'retired Rage Ridge games stay put');
select results_eq(
  $$select name, rule ->> 'icon' from public.badges where id = 'explorer-reflex'$$,
  $$values ('Arcade Explorer', 'game-controller')$$,
  'Explorer badges take their group''s name and icon'
);
select ok(exists (select 1 from public.badges where id = 'explorer-rage'), 'hidden worlds keep their Explorer badge');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'private.world_regroup_undo'::regclass),
  'the undo log has forced RLS');
select results_eq(
  $$select title, (goal ->> 'n')::int from public.quests where id = 'w-3'$$,
  $$values ('Clear games in all 4 worlds', 4)$$,
  'the weekly worlds step fits the 4 groups'
);

-- The rating copy, replayed on fixture rows: a folded track is copied into its group when the player has none
-- there (most games wins), and never overwrites one the player already has.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000c01', 'a@groups.test'),
  ('00000000-0000-0000-0000-000000000c02', 'b@groups.test');
insert into public.players (id, nickname, age_band) values
  ('00000000-0000-0000-0000-000000000c01', 'groups_a', '18+'),
  ('00000000-0000-0000-0000-000000000c02', 'groups_b', '18+');
insert into public.ratings (player_id, track, rating, games) values
  ('00000000-0000-0000-0000-000000000c01', 'line', 1300, 9),
  ('00000000-0000-0000-0000-000000000c01', 'shape', 1100, 2),
  ('00000000-0000-0000-0000-000000000c02', 'rage', 1400, 5),
  ('00000000-0000-0000-0000-000000000c02', 'reflex', 900, 3);
with folded(source, target) as (
  values ('line', 'logic'), ('shape', 'logic'), ('clue', 'word'), ('rage', 'reflex')
),
best as (
  select distinct on (r.player_id, f.target) r.player_id, f.target as track, r.rating, r.rd, r.vol, r.games, r.updated_at
  from public.ratings r join folded f on f.source = r.track
  where r.games > 0 and r.player_id in ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-000000000c02')
  order by r.player_id, f.target, r.games desc, r.updated_at desc
)
insert into public.ratings (player_id, track, rating, rd, vol, games, updated_at)
select player_id, track, rating, rd, vol, games, updated_at from best
on conflict (player_id, track) do nothing;
select is(
  (select rating::int from public.ratings where player_id = '00000000-0000-0000-0000-000000000c01' and track = 'logic'),
  1300,
  'the folded rating with most games is carried into the group'
);
select is(
  (select rating::int from public.ratings where player_id = '00000000-0000-0000-0000-000000000c02' and track = 'reflex'),
  900,
  'an existing group rating is never overwritten'
);
select is(
  (select count(*)::int from public.ratings where player_id = '00000000-0000-0000-0000-000000000c01' and track in ('line', 'shape')),
  2,
  'old tracks stay as history'
);

select * from finish();
rollback;
