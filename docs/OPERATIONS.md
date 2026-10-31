# Operations

Runbooks for running SPUZL in production and staging.

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
