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
