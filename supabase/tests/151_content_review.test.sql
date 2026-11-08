begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Round 3 item 12 (20261207001201): content review history and the retired state.
select has_table('public', 'content_reviews', 'content review history table');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.content_reviews'::regclass),
  'RLS is enabled and forced');

insert into public.games (id, world_id, name, status, phase, engine, scoring, is_unique, min_time_ms, sort)
select 'twotruths', w.id, 'Two Truths and a Lie', 'coming_soon', 'M3+', 'custom', 'score', false, 8000, 61
from public.worlds w where w.id = 'word'
on conflict (id) do nothing;

select lives_ok($$insert into public.content_items (game_id, payload, source, source_ref, source_hash, status)
  values ('twotruths', '{}'::jsonb, 'content_file', 'twotruths:9999', 'abc', 'retired')$$,
  'a content.ts entry can be retired');
select throws_ok($$insert into public.content_items (game_id, payload, source, author_id, status)
  values ('twotruths', '{}'::jsonb, 'editor', (select id from auth.users limit 1), 'retired')$$, '23514', null,
  'an editor draft is rejected, never retired');

select lives_ok($$insert into public.content_reviews (game_id, source_ref, source_hash, decision, reviewer_id)
  values ('twotruths', 'twotruths:9999', 'abc', 'retire', gen_random_uuid())$$, 'a decision is kept with who');
select throws_ok($$insert into public.content_reviews (game_id, source_ref, source_hash, decision, reviewer_id)
  values ('twotruths', 'twotruths:9999', 'abc', 'edit', gen_random_uuid())$$, '23514', null, 'an edit keeps the edited entry');
select throws_ok($$delete from public.content_reviews where source_ref = 'twotruths:9999'$$, 'P0001', null,
  'the history is append-only');

set local role authenticated;
select throws_ok($$select count(*) from public.content_reviews$$, '42501', null, 'players cannot read the history');
select throws_ok($$insert into public.content_reviews (game_id, source_ref, source_hash, decision, reviewer_id)
  values ('twotruths', 'x', 'y', 'approve', gen_random_uuid())$$, '42501', null, 'players cannot write the history');
reset role;

select * from finish();
rollback;
