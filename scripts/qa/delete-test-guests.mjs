#!/usr/bin/env node
/**
 * Deletes the guest accounts a QA or perf run created (one user id per line in the file given), through Supabase
 * Auth's admin API, the same path as the app's own account deletion (everything about the player cascades).
 * Safety: a user is deleted only if it is anonymous and has no email; anyone else is skipped and reported.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… node scripts/qa/delete-test-guests.mjs test-results/r2-guests.txt
 */
import { readFileSync } from "node:fs";

const [file] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !url || !key) {
  console.error("usage: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/qa/delete-test-guests.mjs <ids-file>");
  process.exit(2);
}
const ids = [
  ...new Set(
    readFileSync(file, "utf8")
      .split(/\s+/)
      .filter((x) => /^[0-9a-f-]{36}$/.test(x)),
  ),
];
const h = { apikey: key, Authorization: `Bearer ${key}` };
let deleted = 0,
  skipped = 0,
  gone = 0;
for (const id of ids) {
  const r = await fetch(`${url}/auth/v1/admin/users/${id}`, { headers: h });
  if (r.status === 404) {
    gone++;
    continue;
  }
  const u = await r.json();
  if (!u.is_anonymous || u.email) {
    console.warn(`skipped ${id}: not an anonymous guest`);
    skipped++;
    continue;
  }
  const d = await fetch(`${url}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: h });
  if (d.ok) deleted++;
  else console.warn(`failed ${id}: ${d.status}`);
}
console.log(`deleted ${deleted}, already gone ${gone}, skipped ${skipped} (of ${ids.length})`);
