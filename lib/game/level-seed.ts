import "server-only";
import { createHmac } from "node:crypto";
import { levelSeed } from "./levels";

let warned = false;

/** The secret behind level seeds. LEVEL_SEED_SECRET; otherwise a key derived from the service-role key. */
function levelSecret(env: Record<string, string | undefined> = process.env): string {
  if (env.LEVEL_SEED_SECRET) return env.LEVEL_SEED_SECRET;
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    if (env.NODE_ENV === "production" && !warned) {
      warned = true;
      console.warn("[levels] LEVEL_SEED_SECRET is not set; level seeds use a key derived from SUPABASE_SERVICE_ROLE_KEY.");
    }
    return `service:${env.SUPABASE_SERVICE_ROLE_KEY}`;
  }
  if (env.NODE_ENV === "production") throw new Error("no level seed secret");
  return "spuzl-dev-level-seed";
}

/**
 * The seed of level n, keyed with a server secret: every player gets the same board for "Level 12", but the code
 * shipped to browsers can't reproduce it, so nobody can solve a level offline before playing it. Changing the
 * secret changes every generated level (cleared levels stay cleared), so set it once and leave it.
 */
export function securedLevelSeed(game: string, n: number, secret = levelSecret()): string {
  const base = levelSeed(game, n);
  return `${base}:${createHmac("sha256", secret).update(base).digest("hex").slice(0, 24)}`;
}
