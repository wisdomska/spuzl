-- Dash becomes an endless runner (owner, 14 Nov 2026): Spuz runs on its own, the player jumps and ducks, one hit
-- ends the run and the score is the distance in metres (games/dash/logic.ts). The game is scored like the other
-- score games from now on: leaderboards rank the highest score, then time (svc_* functions read games.scoring).
-- No minimum time: a run can honestly end on the first crate (the replay of the input log is the anti-cheat).
--
-- The Rage Survivor and Untouched badges counted Dash crashes; every Dash run now ends on its one crash, so they are
-- Gotcha's alone (lib/gamification/progress.ts). Their descriptions follow (lib/gamification/badges.ts, seed.sql).
-- Results already stored keep their rows; old Dash Dailies carry no score and rank as 0 on their old boards.
--
-- Rollback:
--   update public.games set scoring = 'deaths', min_time_ms = 5000 where id = 'dash';
--   update public.badges set description = 'Clear a Daily Gotcha or Dash with ' || (rule->>'n') || ' deaths or fewer.'
--     where rule->>'kind' = 'course_deaths';
--   update public.badges set description = 'Clear a Gotcha, Dash or Gauntlet course with zero deaths.' where id = 'secret-pacifist';

update public.games set scoring = 'score', min_time_ms = 0 where id = 'dash';

update public.badges
set description = 'Clear a Daily Gotcha with ' || (rule->>'n') || ' deaths or fewer.'
where rule->>'kind' = 'course_deaths';

update public.badges set description = 'Clear a Gotcha or Gauntlet course with zero deaths.' where id = 'secret-pacifist';
