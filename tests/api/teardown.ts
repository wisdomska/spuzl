import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

/**
 * Vitest global teardown for the API tests: deletes every anonymous guest the run created (listed by
 * tests/api/helpers.ts guest()), so a run against a shared database leaves no test players behind. Accounts with an
 * email are never touched. Best effort: a failure here never fails the run.
 */
export default async function teardown() {
  const file = process.env.QA_GUEST_LOG ?? ".qa/guests-api.txt";
  if (!fs.existsSync(file)) return;
  const ids = [
    ...new Set(
      fs
        .readFileSync(file, "utf8")
        .split(/\s+/)
        .filter((x) => /^[0-9a-f-]{36}$/.test(x)),
    ),
  ];
  const env = Object.fromEntries(
    fs.existsSync(".env.local")
      ? fs
          .readFileSync(".env.local", "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
      : [],
  );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !ids.length) return;
  const db = createClient(url, key, { auth: { persistSession: false } });
  let deleted = 0;
  for (const id of ids) {
    try {
      const { data } = await db.auth.admin.getUserById(id);
      if (!data.user || !data.user.is_anonymous || data.user.email) continue;
      if (!(await db.auth.admin.deleteUser(id)).error) deleted++;
    } catch {
      /* next one */
    }
  }
  fs.writeFileSync(file, "");
  console.log(`[api teardown] deleted ${deleted} of ${ids.length} test guests`);
}
