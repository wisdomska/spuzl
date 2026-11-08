begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

-- Round 3 item 11 (20261207001101): Family Draw words live in public.family_draw_words, server only.
select has_table('public', 'family_draw_words', 'family draw words table');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.family_draw_words'::regclass),
  'RLS is enabled and forced');
select cmp_ok((select count(*)::int from public.family_draw_words where retired_at is null), '>=', 80,
  'seeded with the code list (at least 80 active words)');
select ok(exists (select 1 from public.family_draw_words where word = 'kenkey' and alt = array['dokon']),
  'words keep their other names');

select throws_ok($$insert into public.family_draw_words (word) values ('Banku!')$$, '23514', null,
  'only lower-case letters and single spaces');
select throws_ok($$insert into public.family_draw_words (word, alt) values ('kite tail', array['ok', 'bad-name'])$$, '23514', null,
  'other names follow the same rule');
select throws_ok($$insert into public.family_draw_words (word) values ('banku')$$, '23505', null, 'a word is stored once');

set local role authenticated;
select throws_ok($$select count(*) from public.family_draw_words$$, '42501', null, 'players cannot read the list');
select throws_ok($$insert into public.family_draw_words (word) values ('zebra')$$, '42501', null, 'players cannot write the list');
reset role;

select * from finish();
rollback;
