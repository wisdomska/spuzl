begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

-- R4-15 (20261210150101): approved Quads items join the free-play pool.
select has_column('public', 'content_items', 'pooled_at', 'content_items.pooled_at exists');
select has_column('public', 'content_items', 'pooled_by', 'content_items.pooled_by exists');

insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select 'quads', w.id, 'Quads', 'live', 'L', 'word', 'time', false, 8000, 30
from public.worlds w where w.id = 'word'
on conflict (id) do nothing;
insert into auth.users (id, email, is_anonymous) values
  ('a4150000-0000-4000-8000-000000000001', null, true),
  ('a4150000-0000-4000-8000-000000000002', null, true);
insert into public.content_items (id, game_id, payload, author_id, reviewer_id, status, source) values
  ('c4150000-0000-4000-8000-000000000001', 'quads', '{}'::jsonb, 'a4150000-0000-4000-8000-000000000001',
   'a4150000-0000-4000-8000-000000000002', 'approved', 'editor'),
  ('c4150000-0000-4000-8000-000000000002', 'quads', '{}'::jsonb, 'a4150000-0000-4000-8000-000000000001', null, 'draft', 'editor');

select lives_ok($$update public.content_items set pooled_at = now(), pooled_by = 'a4150000-0000-4000-8000-000000000002'
  where id = 'c4150000-0000-4000-8000-000000000001'$$, 'an approved Quads item joins the pool');
select lives_ok($$update public.content_items set status = 'scheduled' where id = 'c4150000-0000-4000-8000-000000000001'$$,
  'a pooled item can still be scheduled on a Daily');
select throws_ok($$update public.content_items set status = 'rejected' where id = 'c4150000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a pooled item cannot leave review status while in the pool');
select throws_ok($$update public.content_items set pooled_at = now() where id = 'c4150000-0000-4000-8000-000000000002'$$,
  '23514', null, 'a draft never joins the pool');
select lives_ok($$update public.content_items set pooled_at = null, pooled_by = null where id = 'c4150000-0000-4000-8000-000000000001'$$,
  'an item is taken out of the pool');

set local role authenticated;
-- RLS is forced with no player policy: a player's read returns no rows (the table grant itself is Supabase's default).
select is_empty($$select pooled_at from public.content_items$$, 'players cannot read content items');
reset role;

select * from finish();
rollback;
