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

| Job               | Where                            | When (GMT)   | What it does                                                                                                                                                                                                         |
| ----------------- | -------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Daily rollover    | Postgres `pg_cron`               | 00:00 daily  | Ranks yesterday's boards, applies Streak Freezes or breaks streaks, publishes today's Dailies, prunes move logs older than 90 days and abandoned rooms older than 24 h, writes an audit row with any missing Dailies |
| League rollover   | Postgres `pg_cron`               | Monday 00:05 | Top 7 promote, bottom 5 demote, places active players in new groups of 30                                                                                                                                            |
| Crew Clash settle | Postgres `pg_cron`               | Monday 00:07 | Records last week's Crew Clash scores (crew XP that week) and the winner; ties have no winner                                                                                                                        |
| Puzzle buffer     | Vercel cron `/api/cron/generate` | 01:17 daily  | Tops the Daily schedule up to 60 days ahead for all 51 games (Gauntlet weekly), proving uniqueness first                                                                                                             |
| Keep-alive        | GitHub Actions `keepalive.yml`   | every 3 days | Calls `health()` on both Supabase projects so the free tier never pauses them                                                                                                                                        |

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

## Admin bootstrap

The first owner of `/admin` is created from the `INITIAL_OWNER_EMAIL` environment variable. No password is ever generated, stored or logged: the owner receives a password-reset email and chooses their own.

What the bootstrap does (idempotent, safe to re-run):

1. Finds or creates the Supabase Auth user for `INITIAL_OWNER_EMAIL` (email confirmed, no password).
2. Inserts it into `admins` with the role `owner` (or sets the role to `owner` if the row exists).
3. Sends a password-reset email that lands on `/admin/login?reset=1`, only when the user was just created (or on `--resend` / `?resend` if they have never signed in).
4. Writes `admin.add` to `audit_log`.

Run it one of two ways:

- **Script** (from a checkout with the service role key):

  ```sh
  pnpm tsx --env-file=.env.local scripts/bootstrap-owner.mts            # first run
  pnpm tsx --env-file=.env.local scripts/bootstrap-owner.mts --resend   # email again
  ```

  Needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `INITIAL_OWNER_EMAIL` and `NEXT_PUBLIC_SITE_URL`.

- **Server path** on a deployed environment (uses the deployment's own env; the request body is ignored, so no other email can be targeted):

  ```sh
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/admin/bootstrap
  curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://<host>/api/admin/bootstrap?resend"
  ```

Then the owner:

1. Opens the reset link and sets a password (12 characters or more).
2. Scans the QR code with an authenticator app (TOTP) and enters the code. Every later sign-in needs email, password and a code (AAL2). Pages and APIs under `/admin` refuse sessions without the second factor.
3. Adds the team from **Team** (owner only): each new admin gets a reset email and enrols TOTP on first sign-in.

Notes:

- The reset link's redirect must be allowed in Supabase Auth (Site URL or Redirect URLs must include `https://<host>/admin/login`). Otherwise Auth falls back to the Site URL.
- Supabase rate-limits reset emails. When a send is refused, the account and role are still created; re-run with `--resend` later.
- Admin sessions use their own cookie (`sb-spuzl-admin`), so signing in to `/admin` never touches a player's guest session in the same browser.

### Roles

| Role           | Can                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| owner          | Everything, including Sparks prices, feature flags, the team and approving `content.ts` entries.       |
| content_editor | Calendar (approve, lock, regenerate, Swap Daily, schedule), content editor and review, quests, badges. |
| moderator      | Reports, nicknames, flagged scores, bans and resets, school verification.                              |
| analyst        | Live ops, audit log, read-only calendar, flags and catalogue.                                          |

The server checks the role on every `/api/admin` route; the UI only hides what a role cannot do.

## Emergency Swap Daily

When today's Daily is broken: open `/admin/calendar`, click the game's cell for today, then **Swap Daily** and say what is broken. The server generates a fresh puzzle, runs the solve-check (unique where required, `verify()` accepts the answer key), swaps it in with `swapped_from` set to the old puzzle, retires the old one and writes `daily.swap` to the audit log. Players already mid-solve finish on the puzzle they started. Owners and content editors can swap.

## Daily locks

Dailies inside the next 7 days are always locked (cron `spuzl-admin-autolock`, 00:10 GMT). A locked Daily's puzzle can only change through Swap Daily; the database refuses any other change. Later Dailies can be locked or unlocked per slot from the preview, or all at once with **Lock next 7 days** on the calendar.

## Timed bans

Bans with a duration lift themselves (cron `spuzl-admin-lift-bans`, hourly at :07) and log `cron.ban_expiry`.
