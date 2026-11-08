# Migrations: frictionless-play pass

Five forward-only, additive migrations. None rewrites or deletes player data. Each one keeps forced RLS and
locks new objects to the service role. Apply them in order. Every file also carries its rollback SQL in a header
comment.

| Migration                                          | What it adds                                                                                                                                                     | Data impact                                                            | Rollback                                                                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261105000001_game_settings.sql`                 | `game_settings` table (key, jsonb value, who and when). Readable by everyone; written only by `/api/admin/settings` with the service role.                       | New empty table. Code defaults apply when it is empty or missing.      | `drop table public.game_settings;`                                                                                                                                                  |
| `20261105000002_game_library_meta.sql`             | `games.typical_sec` and `games.tags`, nullable and range-checked.                                                                                                | NULL means "use the code default", so there is no backfill.            | `alter table public.games drop column if exists typical_sec, drop column if exists tags;`                                                                                           |
| `20261106100001_starter_cosmetic.sql` (SPZ-19)     | The starter hat row, plus `svc_buy_cosmetic` with an optional `p_starter_price` (the live admin price).                                                          | One new cosmetic. Purchases with three arguments still work.           | Drop the 4-argument functions, re-run the 3-argument versions (listed in the header) and delete the `hat-starter` row. Owned starter hats stay in inventory unless removed by hand. |
| `20261106100002_league_grouping.sql` (SPZ-21)      | `league_candidates`, `join_current_league(player, league)` and a rollover that splits each tier evenly (at most 30 per group).                                   | No existing rows change. It takes effect on the next join or rollover. | Drop the new functions and re-run the earlier versions from `20261102000001_social_meta.sql` and `20261031000001_test_accounts.sql` (listed in the header).                         |
| `20261107000001_admin_metrics.sql` (admin cascade) | `client_metrics` (anonymous: no player id, IP or URL), `svc_admin_metrics(from, to)`, two range indexes, and a nightly job that prunes rows older than 180 days. | New table only.                                                        | Unschedule `spuzl-client-metrics-prune`, then drop the functions, the indexes and `client_metrics` (listed in the header).                                                          |

## Applying

- **Local:** `supabase migration up`. If the shared local history differs, apply each file with `psql` and add
  its row to `supabase_migrations.schema_migrations`.
- **Hosted:** apply through the Supabase SQL API or the dashboard, preview first, then production. All five are
  already applied to the preview project.
- **Order with code:** apply before deploying. Every new read in the app also handles the migration being
  missing:
  - game settings fall back to the defaults
  - Library metadata falls back to the defaults
  - the shop uses the catalogue price

## Verification

- pgTAP: `supabase test db`, including `070_starter_cosmetic` and `080_league_grouping`.
- API: `tests/api/admin.test.ts` covers settings, Library metadata, metrics, role gates and the audit log.
  `tests/api/social.test.ts` covers the starter hat and league placement.
- Each rollback was run inside a transaction that was then rolled back.

## 1.2.0

All migrations are additive and reversible (rollback SQL in each header). None touches existing player data.

| Migration                                       | What it adds                                                                                                                 | Rollback                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `20261108000001_play_day_streak.sql`            | `record_play_day` (a free-play clear extends the streak, once per GMT day) and `played_this_week` (leagues accept any clear) | Re-run the two league functions from `20261106100002`, then drop the new functions           |
| `20261109100001` to `20261109500002` (`_lab_*`) | One `games` row per new game, status `coming_soon`                                                                           | `delete from public.games where id = '<id>'` (no attempts can exist while the switch is off) |
| `20261109600001_seasonal_events.sql`            | `events` and `event_progress` (forced RLS), plus the progress function                                                       | Drop the function and both tables (see header)                                               |

The seed also rewords the badges and quests that mentioned Dailies, and adds the lab game rows. `scripts/gen-seed.ts` now writes them as well.

## 1.3.0

Additive and reversible (rollback SQL in each header). No existing rows change. Applied to preview, then
production, before the code deploys.

| Migration                                    | What it adds                                                                                                                                        | Rollback                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `20261110000001_onboarding_hint_metrics.sql` | New anonymous metric names (`onboarding_step`, `hint_request`, `hint_use`), a counting function, and those counts in the admin metrics              | See header                                     |
| `20261110100001_free_play_rating.sql`        | `svc_free_percentile`: a free-play clear against the last 30 days of free-play clears of that game and difficulty, plus a partial index             | Drop both functions and the index (see header) |
| `20261110200001_attempt_move_log.sql`        | `svc_attempt_log`: appends to the caller's own in-progress attempt's `moves` log (Five and Emoji Hits reveals, Penalty King shots), compare-and-set | Drop the function (see header)                 |

pgTAP: `090_free_play_rating`, `095_admin_metrics_funnel`. If the code ships first, the free-play percentile call
fails soft (each clear counts as an average one), and lab games stay behind their switch.

## 1.4.0

All additive and reversible (rollback SQL in each header). No existing player rows change, except that league
members get a `home_tier` copied from their group at the next rollover.

| Migration                              | What it adds                                                                                                                     | Rollback                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `20261110300001_free_seed_private.sql` | Players keep select on every column of their own attempts except `free_seed` (it rebuilds a free-play solution). No rows change. | `grant select on public.attempts to anon, authenticated;` |

pgTAP: `096_free_seed_private`. No app code reads `attempts` with a player's token, so the order with the code
deploy doesn't matter.

| Migration                          | What it adds                                                                                                                      | Rollback                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `20261111100001_learned_games.sql` | `learned_games` (forced RLS, players read their own rows, the API writes): games learned in a guided first play, kept per account | Drop the table (see header) |

pgTAP: `100_learned_games`. If the code ships first, reads of the missing table fail soft (only this device's
learned games count) and saving a learned game fails quietly (the device keeps it and syncs it later).

| Migration                               | What it adds                                                                                                                              | Rollback   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `20261111000001_league_min_group.sql`   | `league_members.home_tier`; the weekly rollover merges tiers below `leagues.minGroup` into the nearest tier (players keep their own tier) | See header |
| `20261111000002_party_chosen_games.sql` | `matches.chosen_games` (2 to 8 race games the Party host picked; no client writes)                                                        | See header |

pgTAP: `085_league_min_group`, `086_party_chosen_games`.

No existing rows change: every room keeps
`party_mode = 'race'`. The feature stays off until the owner turns on `features.adultParty`.

| Migration                        | What it adds                                                                                                                                                                                                                                                                                                                                                               | Rollback                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261112000001_adult_party.sql` | 18+ party games (Draw It, Two Truths): `matches.party_mode` and `party_leads`, `match_players.kicked_at`, `players.adult_notice_at` and `adult_party_blocked_until`, `reports.snapshot` and target type `party`, the server-only `party_rounds`, `party_guesses` and `party_votes` (forced RLS, no client grants or policies), and `svc_party_strokes` (service role only) | Drop the function and the three tables, delete adult rooms and party reports, then drop the columns and restore the report check (see header) |

pgTAP: `101_adult_party` (RLS and grants, the room check, stroke caps and the drawer-only rule, one correct guess
per round, guess length, cascade with the room, reports kept). The migration, the pgTAP file and the rollback
were each run locally inside a transaction that was rolled back.

If the code ships first, nothing changes while `features.adultParty` is off: race rooms read `party_mode` as
`race` when the column is missing, and the moderation queue only reads `reports.snapshot` on its Party content tab.

## 1.5.0

Additive and reversible (rollback SQL in the header). No existing rows change.

| Migration                               | What it adds                                                                                                                                                                                                                                                                                                                                                                              | Rollback                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `20261114000001_adult_block_reopen.sql` | `svc_adult_party_lift_block` (service role only): after a moderator reopens or dismisses an actioned 18+ party report, it sets the player's `adult_party_blocked_until` to what their other actioned party reports still justify (never later), or clears it, and writes a `player.adult_party_unblock` audit row in the same transaction; plus a partial index on actioned party reports | Drop both functions and the index (see header) |

pgTAP: `103_adult_block_reopen`. The migration, the pgTAP file and the rollback were each run locally inside a
transaction that was rolled back. If the code ships first, reopening an actioned party report works as before
(the report reopens, the block stays).

## 1.6.0

Reversible (rollback SQL in the header). No rows are deleted and no player data changes: attempts, Dailies,
puzzles and results for retired games stay where they are.

| Migration                         | What it does                                                                                                                                                                                                                      | Rollback                                                                                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261116000001_retire_games.sql` | `games.status` accepts `'retired'`; the 32 retired games (`lib/catalog.ts` `RETIRED_IDS`) get it, and Trotro Jam, Emoji Hits and Beat Tap go from `coming_soon` to `live`. The rollover and live-ops gap alert count `live` only. | Set the 3 promoted and 7 retired lab games back to `coming_soon`, the other retired games back to `live`, and restore the 3-value check constraint (see header). |

`supabase/seed.sql` (from `scripts/gen-seed.ts`) writes each game's status from the catalogue, so a fresh database
matches. pgTAP: `105_retire_games`. The migration, the seed, the pgTAP file and the rollback were each run locally
inside a transaction that was rolled back. If the code ships first, players already see 29 games (the catalogue
decides); the migration only lines up the database (gap alerts and the rollover's missing-Dailies count).

## 1.5.1

| Migration                             | What it adds                                                                                           | Rollback                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `20261115000001_admin_email_code.sql` | `admin_verified_sessions` (forced RLS, service role only): sign-in sessions that passed the email code | `drop table if exists public.admin_verified_sessions;` |

pgTAP: `104_admin_verified_sessions`. Apply before the code deploys, or admins see "aal2 required" until it lands.

## 1.6.0

Additive and reversible (rollback SQL in the header). No existing rows change.

| Migration                        | What it adds                                                                                                                                                                                                                                                                                   | Rollback                                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `20261117000001_board_queue.sql` | `board_queue` (forced RLS, service role only): one Board Bay "Play live" search per player (game, rating, when they joined, last poll, the match it found); and `svc_bay_mm_claim(players, game, match)` (service role only), which pairs waiting entries atomically and refuses blocked pairs | `drop function if exists public.svc_bay_mm_claim(uuid[], text, uuid); drop table if exists public.board_queue;` |

pgTAP: `106_board_queue`. Apply before the code deploys: until it lands, Play live answers with an error and
everything else in Board Bay works as before.

## 1.6.0: level ladders

Additive and reversible (rollback SQL in the header). No existing rows change.

| Migration                          | What it adds                                                                                                                                                                                                                                                                                            | Rollback                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `20261118000001_player_levels.sql` | `player_levels` (player, game, level, best time, first clear; forced RLS, players read their own, no client writes), `svc_record_level_clear` (keeps the best time, refuses a level more than one past the highest clear) and `svc_level_tops` (both service role only), and `level` in `attempts.mode` | Drop both functions and the table, delete `level` attempts, then restore the old mode check (see header) |

pgTAP: `107_player_levels` (forced RLS and grants, the unlock rule, best time kept on replays, per game and per
player, account deletion cascades). The migration, the pgTAP file and the rollback were each run locally inside a
transaction that was rolled back.

Apply before the code deploys: until it lands, starting a level answers an error (the `level` mode and the table
are missing), while daily and free play are unaffected.

## Age from birth month and year

Additive and reversible (rollback SQL in the header). Existing rows keep their `age_band`; nothing is backfilled.

| Migration                             | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rollback                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `20261119000001_birth_month_year.sql` | `players.birth_year` and `birth_month` (smallint, range-checked, both or neither); `age_band_of(year, month, today)` (the one age rule, mirrored by `lib/age`); trigger `players_age_band` (derives `age_band` from birth month and year, refuses under 13, locks them once set except inside the admin correction); `private.refresh_age_bands()` on pg_cron `spuzl-age-band-refresh` (00:03 GMT daily); `svc_admin_set_birth` (service role only, audited by band, never the date). RLS on `players` unchanged and still forced. | Unschedule the job, then drop the functions, the trigger, the pair check and both columns (see header). Bands stay as last derived. |

How the band is derived and refreshed: a player turns a year older on the 1st of the month after their birth month
(no day is kept, so the careful reading), so bands only change on the 1st of a month. The stored `age_band` is
set by the trigger on every write and moved by the daily job, so views, leaderboards and filters that read it are
right from 00:03 GMT on the 1st. The API also derives the band at read time for the signed-in player
(`requirePlayer`) and for other players it reads with their birth month and year, so gates never wait for the job.

pgTAP: `108_birth_month_year` (forced RLS, the rule at the 13/16/18 month boundaries, derived band, under 13
refused, lock, legacy players adding theirs once, the refresh, the audited admin correction, deletion). The
migration, every pgTAP file with it applied, and the rollback were run locally inside transactions that were
rolled back.

Apply before the code deploys. The signed-in player and Me fall back to the stored band while the columns are
missing, but new profiles need the columns, and friends, crews, matches and status cards read them.

## 18+ party rewards

Additive and reversible (rollback SQL in the header). No existing rows change.

| Migration                                | What it adds                                                                                                                                                                                                                                                                                                                                     | Rollback                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `20261120000001_adult_party_rewards.sql` | `party_rounds.played` (uuid[], at most 8, default empty; RLS still forced, no client access): who took part in each round, kept after the round's text and strokes are wiped; `svc_grant_capped_reward` (service role only): `svc_grant_reward` with XP clamped to a daily cap per source (GMT day), Sparks only under it, the player row locked | Drop both functions, then the column (see header). `party_adult` ledger rows stay (the ledgers are append-only) |

pgTAP: `109_adult_party_rewards` (forced RLS and grants, the `played` limit, once per ref, the clamp, a capped
grant marking its ref paid, per-source and per-day caps). The migration, `101_adult_party`, `103_adult_block_reopen`
and `109` with it applied, and the rollback, were run locally inside one transaction that was rolled back.

Apply before the code deploys. Until it lands, rounds still close and wipe as before (the `played` write is
separate and only logs an error), and finished 18+ rooms pay nothing.

## Four worlds (Unreleased)

Reversible (rollback SQL in the header). No rows are deleted and no earned badge or attempt changes. There is no
real player data in production yet, but the migration is written as if there were.

| Migration                         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Rollback                                                                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20261121000001_world_groups.sql` | `worlds`: `logic`, `word`, `reflex` and `board` are renamed Puzzles, Words & Quiz, Arcade and Board Games and sorted first; `line`, `shape`, `number`, `clue` and `rage` keep their rows (retired games, old results). `games.world_id`: weave, flowline, pairup, lost and trotro move to `logic`, quickfire and emojihits to `word`, gotcha, dash and gauntlet to `reflex`. `ratings`: a folded world's rating is copied into its group when the player has none there (most games wins); old tracks stay. `events`: bonus quests on a folded world point at its group. `badges`: the 4 Explorer badges take the group name and icon; the others stay; Untouched names the courses. `quests`: titles name the groups; `w-3` asks for 4 worlds. Copies and event changes are logged in `private.world_regroup_undo` (forced RLS, no policies, service role only). | Restore event worlds and delete the copied ratings from the undo log, drop it, move the 10 games back, and restore world, badge and quest names, sorts and goals (see header). Exact, checked by diff locally. |

The ids stay, so `/world/logic` and friends, rating tracks, badge ids and quest ids do not change. `/world/line`,
`/world/shape`, `/world/clue` and `/world/rage` answer a 308 to their group (`proxy.ts`, from `MERGED_WORLDS` in
`lib/catalog.ts`); `/world/number` stays not found.

`supabase/seed.sql` (from `scripts/gen-seed.ts`) writes the same names, sorts, world ids, badges and quests, so a
fresh database matches. pgTAP: `110_world_groups` (live games in the 4 groups and their counts, the folded worlds
kept and empty of live games, Explorer badges, the undo log's forced RLS, the weekly quest, and the rating copy on
fixture rows: most games wins, an existing group rating is never overwritten, old tracks stay). The migration and
the pgTAP file were run locally inside a transaction that was rolled back; the rollback was run after the
migration in another rolled-back transaction and left worlds, games, badges, ratings, events and quests identical
to before.

Order: either way works. If the code ships first, players already see the 4 worlds (the catalogue decides) and
moved games rate into their group's track; the migration lines up world names, carried-over ratings, badges and
quests in the database.

## 1.9.0

| Migration                                 | What it does                                                                                        | Rollback    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| `20261122000001_last_active_backfill.sql` | Data only: fills `players.last_seen_at` from the latest game or sign-in where it was empty or older | None needed |

## 1.12.0

| Migration                              | What it does                                                                                                                                                                                                 | Rollback           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `20261123000001_bay_time_controls.sql` | Board Bay live time controls: `board_matches.clock_base_ms`, `board_queue.clock_ms` (default 5 min) with an index, and `svc_bay_mm_claim_timed`, which only pairs players waiting for the same game and time | In the file header |

## 1.15.0

| Migration                       | What it does                                                                                                                                             | Rollback           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261124000001_match_chat.sql` | Duel and Party chat: `match_messages` (server-written only, forced RLS), `svc_prune_match_messages` and a nightly cron that drops chat older than 7 days | In the file header |

## 1.17.0

| Migration                            | What it does                                                                                                                                  | Rollback           |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261125000001_retire_gauntlet.sql` | Retires Gauntlet (`games.status = 'retired'`, no rows deleted) and moves the Rage Survivor badges to a Daily Gotcha or Dash (`course_deaths`) | In the file header |

## 1.22.0

| Migration                             | What it does                                                                                                               | Rollback           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261126000001_party_pass_round.sql` | `match_players.passed_round`: the Party round a player skipped (0 points, the round stops waiting for them)                | In the file header |
| `20261127000001_bay_chat.sql`         | Chat in Board Games: `match_messages.bay_id` (to `board_matches`), `match_id` now nullable, exactly one of the two per row | In the file header |

## 1.24.0

| Migration                     | What it does                                                                                                                                                                                   | Rollback           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261128000001_web_push.sql` | Web Push: `push_subscriptions` (one row per device with alerts on) and `server_secrets` (the VAPID key pair, inserted once per project by an operator, never in a migration); both server-only | In the file header |

After applying it to a new project, insert a VAPID key pair (generate with `web-push generate-vapid-keys`):
`insert into public.server_secrets (key, value) values ('vapid_public', '<public>'), ('vapid_private', '<private>');`
Without it push stays off and everything else works.

## 1.29.0

| Migration                              | What it does                                                                                                                                  | Rollback           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261129000001_rank_from_matches.sql` | `rank_contributions`: one row per player per Duel or Party round that counted towards their rank (so a round never counts twice); server-only | In the file header |
| `20261129000002_board_queue_rules.sql` | `board_queue.rules`: the Ludo house rules a player picked before Play live; only the same rules are paired                                    | In the file header |

## 1.31.0

| Migration                                    | What it does                                                                                                           | Rollback           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `20261130000001_rank_contribution_delta.sql` | `rank_contributions.track` and `delta`: which category a counted round moved and by how much (shown on the end screen) | In the file header |
| `20261130000002_board_queue_seats.sql`       | `board_queue.seats`: Play live Ludo for 3 or 4 players; only the same table size is grouped                            | In the file header |

## R2 (1.34.0 to 1.39.0)

All applied to preview and production; the last batch (20261202000101 to 20261205005401) on 7 November 2026.

| Migration                                     | What it does                                                                                                                                                                                                                                                                                                                                                                                                             | Rollback           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| `20261130100201_duel_created_metric.sql`      | R2-02: `client_metrics.band` (age band only) and the server-recorded `duel_created` name; `private.admin_duel_bands` merged into `svc_admin_metrics` for the Metrics card "Duels created by age band"                                                                                                                                                                                                                    | In the file header |
| `20261130100301_party_first_move_metric.sql`  | R2-03: `client_metrics` accepts `party_first_move` (ms from a Party game's start to a racer's first move); `svc_admin_metrics` adds its count, p50 and p95 per day/range                                                                                                                                                                                                                                                 | In the file header |
| `20261130100401_prompt_metrics.sql`           | R2-04: `client_metrics` accepts `prompt_shown`, `prompt_accepted`, `prompt_dismissed` (mode = prompt, kind = trigger); `private.admin_prompt_metrics` counts them per day and per trigger, merged into `svc_admin_metrics`                                                                                                                                                                                               | In the file header |
| `20261130100501_daily_five.sql` (R2-05)       | `daily_five` (date, slot 1-5, game, scheduled puzzle, auto or manual, lock; server only, RLS forced, a trigger keeps locked days); `attempts.daily_five` (default false); `client_metrics` accepts `daily5_start`, `daily5_complete`, `daily5_share`; `svc_admin_metrics` adds the Daily Five numbers                                                                                                                    | In the file header |
| `20261130101301_room_join_requests.sql`       | R2-13: `room_join_requests`, the requests to join an under-16 host's friends-only room and the admin join-approval log (who asked, host, room, outcome, time); forced RLS, no client grants (API only), pruned after 180 days                                                                                                                                                                                            | In the file header |
| `20261130109901_admin_metrics_all.sql`        | Round 2: one `svc_admin_metrics` merging every part (duel bands, Party first move, prompts, Daily Five) and the full `client_metrics` name check, after the R2 tickets that each redefined it                                                                                                                                                                                                                            | In the file header |
| `20261201001401_quads.sql`                    | R2-14: Quads is live again (`games.status` retired to live), and `games.sort` follows the catalogue (Quads after Rungs, retired games after the live ones, as `scripts/gen-seed.ts` writes it). No rows deleted or added                                                                                                                                                                                                 | In the file header |
| `20261201001801_library_new_tag.sql`          | R2-18: `games.tags` may hold `new` (check widened), so the admin Library page marks which games count as new for Home's "N new games" banner and the Library's New filter                                                                                                                                                                                                                                                | In the file header |
| `20261202000101_games_rule_blurb.sql`         | R2-ADMIN: `games.rule` and `games.blurb`, admin overrides of a game's one-line rule and card copy (one line, at most 130 characters; NULL = the catalog's copy), set on the admin Library page and served by `/api/v1/games/meta`                                                                                                                                                                                        | In the file header |
| `20261202000301_tap_warmth_metric.sql`        | R2-ADMIN: `client_metrics.warm` (tap_to_board only: first board of the page session or a later one) and `private.admin_tap_warmth` (cold and warm count, p50, p95); `svc_admin_metrics` redefined with every existing part plus this one                                                                                                                                                                                 | In the file header |
| `20261202000401_first_clear_metric.sql`       | R2-ADMIN: `private.admin_first_clear`, landing (profile created) to first clear outside the tutorial per cohort day (new players, cleared, p50, p95); `svc_admin_metrics` redefined with every part so far plus this one                                                                                                                                                                                                 | In the file header |
| `20261202000501_practice_metrics.sql`         | R2-ADMIN: `client_metrics` accepts `practice_start`, `practice_finish`, `practice_skip` (game only; name check widened with the full list); `private.admin_practice` counts them per day and per game; `svc_admin_metrics` redefined with every part so far plus this one                                                                                                                                                | In the file header |
| `20261202000601_retention_cohorts_metric.sql` | R2-ADMIN: `private.admin_retention_cohorts`, D1 and D7 retention per cohort day (first attempt that day, the Live ops rule), due days only; `svc_admin_metrics` redefined with every part so far plus this one                                                                                                                                                                                                           | In the file header |
| `20261202000701_game_over_metric.sql`         | R2-ADMIN: `client_metrics` accepts `game_over` (mode `bay` or `bot`, kind `won`, `lost` or `draw`; name check widened with the full list); `private.admin_game_over` counts them; `svc_admin_metrics` redefined with every part (the final definition)                                                                                                                                                                   | In the file header |
| `20261203005101_lab_games.sql`                | R2-P5: eleven retired games come back as lab games (`games.status` retired to `coming_soon`, only rows still retired), switched on per game by the new setting `features.labGames`; Higher or Lower, Market Run and Killer Sums move to Puzzles and Pinned and Flagged to Words & Quiz (`games.world_id`); `games.sort` follows the catalogue. No rows deleted or added; a stored `features.newGames` row is now ignored | In the file header |
| `20261204000301_party_tv.sql`                 | R2-P5: `matches.tv_open` (default false; new classroom rooms set it on): the host lets anyone with the code watch the read-only big-screen view `/party/<code>/tv`. The API enforces it (and the admin switch `features.partyTv`)                                                                                                                                                                                        | In the file header |
| `20261204000401_event_templates.sql`          | R2-P5: `events.draft` (default false; template events start as drafts and never run until scheduled), `events.quiz` (a Quickfire quiz set the event features: `ghana-1957`), `events.template`; partial index for the live-event lookup                                                                                                                                                                                  | In the file header |
| `20261204000501_streak_shield.sql`            | R2-P5: `svc_signin_shield(player)`: a guest who links an email or Google account gets one Streak Freeze (max 2), once per account (ledger ref `shield`/`signin`, zero Sparks), audited as `player.shield`. Service role only                                                                                                                                                                                             | In the file header |
| `20261204000601_school_leagues.sql`           | R2-P5: `schools.kind` (school or campus), `schools.updated_at`, `players.school_set_at` (one self-picked school change a week); `svc_school_league(week, metric, min)`: weekly school table (active players, total and average clears or Sparks; names and aggregates only, schools under the minimum left out). Service role only                                                                                       | In the file header |
| `20261204000701_growth_metrics.sql`           | R2-P5 (admin cascade): `client_metrics` accepts `party_tv_view`, `streak_shield`, `school_join`; `private.admin_growth` counts them per GMT day; `svc_admin_metrics` redefined with every part plus this one (admin Metrics card "Party TV, streak shields and school leagues", CSV)                                                                                                                                     | In the file header |
| `20261205005201_lab_twotruths.sql`            | R2-P5 part B: the `public.games` row for Two Truths and a Lie (`twotruths`, Words & Quiz, `coming_soon`), a new lab game; also lets the admin Content page draft rounds (`content_items.game_id` foreign key). No other change                                                                                                                                                                                           | In the file header |
| `20261205005301_lab_azonto.sql`               | R2-P5 part B: the `public.games` row for Azonto Steps (`azonto`, Arcade, `coming_soon`, `min_time_ms` 1500, the shortest honest run), a new lab game. No other change                                                                                                                                                                                                                                                    | In the file header |
| `20261205005401_party_family_draw.sql`        | R2-P5 part B: Family Draw (Draw It for 16+): `matches.party_mode` also takes `drawfam`; `party_rounds.options` (a round's four preset words); `party_guesses.pick` with `party_guesses_pick_once` (one pick per player per round, no text). RLS stays forced, no client grants. No existing rows change                                                                                                                  | In the file header |
| `20261206000101_remove_school_leagues.sql`    | Removes the R2-P5 school and campus leagues: drops `svc_school_league`, `schools.kind`, `schools.updated_at`, `players.school_set_at`, the league's school-search index and the `school_join` metric (never used on production). School Cup untouched                                                                                                                                                                    | In the file header |
| `20261206000201_remove_schools.sql`           | Removes schools and campuses everywhere: drops the School Cup tables and functions, `schools`, `players.school_id`, the School leaderboard scope (`private.leaderboard` redefined), the `school` column of `player_cards` (view recreated), the `social-school` badge and the `school_cup` flag. No rows existed on production or preview                                                                                | In the file header |

## Round 3 (unreleased)

| Migration                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                | Rollback                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `20261207000901_streak_nudge.sql` | R3-09: `alert_prefs` (the player's Streak reminders switch; no row = on) and `streak_nudges` (send log, one row per player per GMT day, pruned after 90 days by `spuzl-streak-nudges-prune`); `svc_streak_nudge_candidates(today, min, limit)` (alerts on, streak at risk, not nudged today, never banned or test); `private.admin_streak_nudge` (sent, cleared within 3 h); `svc_admin_metrics` redefined with every part plus this one. RLS forced, service role only | In the file header |
| `20261207001401_remove_azonto.sql` | R3-14: removes the R2-P5 part B dance lab game completely: deletes its `games` row and every row that points at it (matches, queue, feed, Daily Five, daily results, challenges, ghost runs, attempts, dailies, content, levels, learned, client metrics, puzzles), clears `players.playing_game` for it and takes its id out of array settings (`features.labGames`, `practice.disabled`). Production had it switched off. | Re-run the insert in `20261205005301_lab_azonto.sql`; deleted test rows are not restored. |
