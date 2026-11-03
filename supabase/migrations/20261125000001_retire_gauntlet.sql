-- Gauntlet was ten Gotcha-style troll rooms in a row, so the owner retired it: Gotcha covers the same play.
-- Like the 32 games retired in 20261116000001, its code stays (lib/catalog.ts RETIRED_IDS), the app hides it and
-- the server refuses it like an unknown game. No rows are deleted: its attempts, Dailies and results stay.
--
-- The four Rage Survivor badges were earned on Gauntlet. They move to a Daily Gotcha or Dash (rule kind
-- course_deaths, lib/gamification/progress.ts); badges already earned stay earned.
--
-- Rollback:
--   update public.games set status = 'live' where id = 'gauntlet';
--   update public.badges
--     set description = 'Clear Gauntlet with ' || (rule->>'n') || ' deaths or fewer.',
--         rule = jsonb_set(rule, '{kind}', '"gauntlet_deaths"')
--     where id in ('rage-100', 'rage-50', 'rage-20', 'rage-5');
--   delete from supabase_migrations.schema_migrations where version = '20261125000001';

update public.games set status = 'retired' where id = 'gauntlet';

update public.badges
set description = 'Clear a Daily Gotcha or Dash with ' || (rule->>'n') || ' deaths or fewer.',
    rule = jsonb_set(rule, '{kind}', '"course_deaths"')
where id in ('rage-100', 'rage-50', 'rage-20', 'rage-5');
