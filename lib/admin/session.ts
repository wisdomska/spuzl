/**
 * Admin sessions live in their own cookie, apart from the player guest session, so signing in to /admin
 * never replaces (or reuses) a player's anonymous account in the same browser. Shared by client and server.
 */
export const ADMIN_COOKIE = "sb-spuzl-admin";

/** Authenticator assurance level from a Supabase access token. The token must already be verified. */
export function aalOf(accessToken: string): "aal1" | "aal2" | null {
  try {
    const part = accessToken.split(".")[1];
    const json = JSON.parse(
      typeof atob === "function"
        ? atob(part.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(part, "base64url").toString("utf8"),
    ) as { aal?: string };
    return json.aal === "aal2" ? "aal2" : json.aal === "aal1" ? "aal1" : null;
  } catch {
    return null;
  }
}
