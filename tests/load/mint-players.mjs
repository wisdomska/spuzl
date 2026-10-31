/**
 * LOCAL ONLY. Creates N load-test players (auth users + profiles) on the local Supabase stack and prints
 * their access tokens as a JSON array. Tokens are signed with the local JWT secret from `supabase status`,
 * which sidesteps the anonymous sign-in rate limit. Refuses to run against anything but localhost.
 *
 *   node tests/load/mint-players.mjs 500 http://localhost:3400 > /tmp/tokens.json
 */
import { createHmac, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";

const N = Number(process.argv[2] ?? 500);
const APP = process.argv[3] ?? "http://localhost:3400";
const env = Object.fromEntries(
  execSync("npx -y supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
for (const u of [env.API_URL, APP])
  if (!/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u)) throw new Error(`refusing non-local target ${u}`);

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (sub) => {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const body = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 6 * 3600, is_anonymous: true });
  return `${head}.${body}.${createHmac("sha256", env.JWT_SECRET).update(`${head}.${body}`).digest("base64url")}`;
};
const admin = { apikey: env.SERVICE_ROLE_KEY, authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "content-type": "application/json" };

const tokens = [];
async function one(i) {
  const r = await fetch(`${env.API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email: `load${i}-${randomUUID().slice(0, 6)}@load.test`, password: randomUUID(), email_confirm: true }),
  });
  const user = await r.json();
  if (!user.id) throw new Error(JSON.stringify(user));
  const token = sign(user.id);
  const p = await fetch(`${APP}/api/v1/profile`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ nickname: `L${randomUUID().replace(/-/g, "").slice(0, 10)}`, ageBand: "18+", color: "#7C5CFF" }),
  });
  if (!p.ok) throw new Error(`profile ${p.status} ${await p.text()}`);
  tokens.push(token);
}
for (let i = 0; i < N; i += 20) await Promise.all(Array.from({ length: Math.min(20, N - i) }, (_, k) => one(i + k)));
process.stdout.write(JSON.stringify(tokens));
