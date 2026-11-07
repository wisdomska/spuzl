begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- R2-ADMIN (20261202000101): games.rule and games.blurb, one-line copy overrides of at most 130 characters.
select has_column('public', 'games', 'rule', 'games.rule exists');
select has_column('public', 'games', 'blurb', 'games.blurb exists');

select lives_ok($$update public.games set rule = repeat('a', 130), blurb = 'Light and dark.' where id = 'dusk'$$,
  'one line of up to 130 characters is accepted');
select throws_ok($$update public.games set rule = repeat('a', 131) where id = 'dusk'$$, '23514', null,
  'a rule over 130 characters is refused');
select throws_ok($$update public.games set blurb = E'one\ntwo' where id = 'dusk'$$, '23514', null,
  'card copy with a line break is refused');
select throws_ok($$update public.games set rule = '   ' where id = 'dusk'$$, '23514', null, 'blank copy is refused (NULL resets)');
select lives_ok($$update public.games set rule = null, blurb = null where id = 'dusk'$$, 'NULL resets to the catalog default');

select * from finish();
rollback;
