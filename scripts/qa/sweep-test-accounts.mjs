#!/usr/bin/env node
/**
 * Clears out test accounts left behind on a Supabase project (preview mostly): every anonymous guest with no email
 * and every address on the reserved .test domain (see test-account.mjs) that is older than `--hours` (default 6, so
 * a run in progress keeps its players). Deleted through Supabase Auth's admin API, the same path as the app's own
 * account deletion, so everything about the player goes with it. Accounts with a real email are never touched.
 *
 * Never on production: real players there are anonymous guests too, so the script refuses the production project.
 * Production test runs delete their own guests by id (delete-test-guests.mjs).
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node scripts/qa/sweep-test-accounts.mjs [--hours 6] [--dry-run]
 */
import { pickStale } from "./test-account.mjs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run");
const hi = args.indexOf("--hours");
const hours = hi >= 0 ? Number(args[hi + 1]) : 6;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !Number.isFinite(hours) || hours < 0) {
  console.error("usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/qa/sweep-test-accounts.mjs [--hours 6] [--dry-run]");
  process.exit(2);
}
// The production project (lib/env and the Vercel project's settings): its guests are real players.
const PRODUCTION_REF = "xwpllzwnhrrhybezkbxz";
if (url.includes(PRODUCTION_REF)) {
  console.error("refused: this is the production project, where anonymous guests are real players");
  process.exit(2);
}
const h = { apikey: key, Authorization: `Bearer ${key}` };

const users = [];
for (let page = 1; ; page++) {
  const r = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=500`, { headers: h });
  if (!r.ok) {
    console.error(`listing users failed: ${r.status}`);
    process.exit(1);
  }
  const batch = (await r.json()).users ?? [];
  users.push(...batch);
  if (batch.length < 500) break;
}

const stale = pickStale(users, Date.now() - hours * 3600_000);
let deleted = 0;
for (const u of stale) {
  if (dry) continue;
  const d = await fetch(`${url}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: h });
  if (d.ok || d.status === 404) deleted++;
  else console.warn(`failed ${u.id}: ${d.status}`);
}
console.log(
  `${users.length} accounts; ${stale.length} test accounts older than ${hours} h` +
    (dry ? " (dry run, nothing deleted)" : `; deleted ${deleted}`) +
    `; kept ${users.length - stale.length}`,
);
