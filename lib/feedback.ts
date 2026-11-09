/**
 * R4-02 feedback, the way SPIL does it: a short form on /contact (optional email, a message, what it's about, and
 * the page it was opened from). Pure and free of server imports: shared by the form, the API, the admin console
 * and the tests. The database checks the same limits (migration 20261209000201_feedback.sql).
 */
import { z } from "zod";

export const FEEDBACK_KINDS = ["bug", "puzzle", "idea", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["new", "read", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const EMAIL_MAX = 254;
/** Longest page path kept with a message; anything longer is dropped, not cut. */
export const FROM_MAX = 200;
export const USER_AGENT_MAX = 200;
/** Messages one player (or one hashed address when signed out) may send per window. */
export const FEEDBACK_RATE = { max: 5, windowSeconds: 3600 } as const;

/**
 * The page a message was sent from, as a bare path: `?from=/games/crownfall?x=1#y` keeps `/games/crownfall`.
 * Anything that isn't a same-site path (another host, `//host`, a backslash, a scheme, odd characters, `..`) is
 * dropped, so the console never shows or links a crafted address.
 */
export function sanitiseFrom(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s.length > FROM_MAX * 2) return null;
  const path = s.split(/[?#]/, 1)[0];
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (path.length > FROM_MAX || !/^\/[A-Za-z0-9\-._~/%@]*$/.test(path)) return null;
  if (path.split("/").some((seg) => seg === ".." || seg === ".")) return null;
  // Percent-escapes must decode cleanly (and not hide a slash or a control character).
  try {
    const decoded = decodeURIComponent(path);
    if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.includes("//")) return null;
  } catch {
    return null;
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** `/contact?from=<path>`, the link the in-app entry points open (Settings, Me, the landing footer). */
export function feedbackHref(from?: string | null): string {
  const path = sanitiseFrom(from);
  return path ? `/contact?from=${encodeURIComponent(path).replace(/%2F/g, "/")}` : "/contact";
}

const emailOk = (v: string) => z.email().safeParse(v).success;

/** What the form posts to POST /api/v1/feedback. `website` is the honeypot: people never see or fill it. */
export const FeedbackInput = z.object({
  message: z.string().trim().min(MESSAGE_MIN).max(MESSAGE_MAX),
  email: z
    .string()
    .trim()
    .max(EMAIL_MAX)
    .refine((v) => v === "" || emailOk(v), { message: "bad_email" })
    .optional(),
  kind: z.enum(FEEDBACK_KINDS).optional(),
  from: z
    .string()
    .max(FROM_MAX * 2)
    .optional(),
  website: z.string().max(500).optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackInput>;

/** The user agent as stored: trimmed to 200 characters, control characters removed, null when absent. */
export function trimUserAgent(ua: string | null | undefined): string | null {
  const s = (ua ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, USER_AGENT_MAX) : null;
}

/** Client-side check before sending, mirroring the server: the copy key of the first problem, or null. */
export function feedbackProblem(input: { message: string; email: string }): "short" | "long" | "email" | null {
  const m = input.message.trim();
  if (m.length < MESSAGE_MIN) return "short";
  if (m.length > MESSAGE_MAX) return "long";
  const e = input.email.trim();
  if (e && (e.length > EMAIL_MAX || !emailOk(e))) return "email";
  return null;
}
