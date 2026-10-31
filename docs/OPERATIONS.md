# Operations

SPUZL runs on free tiers. This page covers the setup, what to watch, and when to pay.

## Environments

|                  | Production                                                | Staging (preview)                                        |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------- |
| Branch           | `main`                                                    | `preview` (and every feature branch)                     |
| URL              | https://spuzl.vercel.app                                  | https://spuzl-preview.vercel.app (Vercel login required) |
| Supabase project | `spuzl-prod` (`xwpllzwnhrrhybezkbxz`, London `eu-west-2`) | `spuzl-preview` (`cbwkrkftkkdgagambmfn`, London)         |
| Vercel functions | London (`lhr1`)                                           | London (`lhr1`)                                          |

Environment variables live in Vercel (Project → Settings → Environment Variables), split by Production and Preview: Supabase URL and keys, `CRON_SECRET`, `INITIAL_OWNER_EMAIL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_REALTIME_TRANSPORT`. Optional: `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Each feature switches off cleanly when its key is missing.

## Scheduled jobs

| Job             | Where                            | When (GMT)   | What it does                                                                                                                                                                                                         |
| --------------- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily rollover  | Postgres `pg_cron`               | 00:00 daily  | Ranks yesterday's boards, applies Streak Freezes or breaks streaks, publishes today's Dailies, prunes move logs older than 90 days and abandoned rooms older than 24 h, writes an audit row with any missing Dailies |
| League rollover | Postgres `pg_cron`               | Monday 00:05 | Top 7 promote, bottom 5 demote, places active players in new groups of 30                                                                                                                                            |
| Puzzle buffer   | Vercel cron `/api/cron/generate` | 01:17 daily  | Tops the Daily schedule up to 60 days ahead for all 51 games (Gauntlet weekly), proving uniqueness first                                                                                                             |
| Keep-alive      | GitHub Actions `keepalive.yml`   | every 3 days | Calls `health()` on both Supabase projects so the free tier never pauses them                                                                                                                                        |

Check the jobs: `select action, detail, created_at from audit_log where action like 'cron.%' order by id desc limit 20;` in each project's SQL editor. `missing_dailies` must be 0.

## Free-tier limits and when to upgrade

| Service                        | Free limit                                                                                                                                                      | Watch                                                                    | Upgrade when                                                                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel Hobby                   | 100 GB bandwidth, 1M function calls, cron once a day, **non-commercial use only**                                                                               | Usage tab                                                                | Before charging money (Hobby forbids commercial use), or above ~80% bandwidth: Pro $20/month                                                      |
| Supabase Free (per project)    | 500 MB database, 1 GB storage, 5 GB egress, 50k monthly active users, 200 concurrent realtime connections, 2M realtime messages/month, pauses after 7 idle days | Project → Reports; `select pg_size_pretty(pg_database_size('postgres'))` | Above ~400 MB or ~150 concurrent realtime users, or before monetisation: Pro $25/month per project. The SRS expects this around 10k daily players |
| Realtime spike                 | 200 concurrent connections                                                                                                                                      | Supabase realtime report                                                 | Switch `NEXT_PUBLIC_REALTIME_TRANSPORT` to `ably` (6M messages/month free) or `partykit` without code changes                                     |
| GitHub Actions                 | 2,000 minutes/month on private repos, unlimited on public                                                                                                       | Actions usage                                                            | n/a while the repo is public                                                                                                                      |
| Sentry Developer, PostHog free | 5k errors and 1M events/month                                                                                                                                   | Their dashboards                                                         | When near the quota                                                                                                                               |

Rules of thumb that keep usage low: one realtime channel per match or room, progress throttled to 2 messages a second, Presence only in lobbies, Dailies pre-generated and cached, 3D art pre-rendered at build time.

## Monitoring checklist (weekly)

1. Vercel usage and function errors.
2. Supabase database size, egress and realtime peaks for both projects.
3. `audit_log` cron rows: no missing Dailies, the league rollover ran on Monday.
4. Flagged scores in `/admin` → Moderation.
5. Sentry error trends (when the DSN is set).

## Manual GitHub settings (owner only)

This build environment cannot change GitHub repository settings, so set these once in the GitHub web UI:

1. **Branch protection** (Settings → Branches → Add rule) for `main` and for `preview`:
   - Require a pull request before merging (0 approvals is fine for a solo owner).
   - Require status checks to pass: `Typecheck, lint, format, unit`, `Database (pgTAP) and API integration`, `Build and bundle budget`, `Authorship`. Tick "Require branches to be up to date".
   - Require linear history. Do not allow force pushes or deletions.
2. **Merge button** (Settings → General → Pull Requests): allow squash merging only, and tick "Automatically delete head branches".
3. **Secrets for the manual puzzle workflow** (optional): create environments `production` and `preview` (Settings → Environments), each with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The daily Vercel cron already keeps the buffer full, so this is only a fallback.
4. **PR descriptions**: PRs opened from the build environment get an automatic tool footer appended. Delete that line from the description before merging (the `Authorship` check fails until you do).

## Rotating credentials

Rotate the GitHub token, Vercel token and Supabase access token used during the build. For the Supabase service-role key, roll it in Supabase (Project → Settings → API), then update `SUPABASE_SERVICE_ROLE_KEY` in Vercel for that environment and redeploy.
