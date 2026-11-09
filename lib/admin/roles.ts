/**
 * Admin roles and what each may do (FR-AD-01). Shared by the server gate (the authority) and the /admin UI,
 * which only hides what a role cannot do. Keep this file free of server imports.
 */
export const ROLES = ["owner", "content_editor", "moderator", "analyst"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  content_editor: "Content editor",
  moderator: "Moderator",
  analyst: "Analyst",
};

const ALL = ROLES;
const EDIT = ["owner", "content_editor"] as const;
const MOD = ["owner", "moderator"] as const;

/** Permission name to the roles that hold it. Owner holds everything. */
export const PERMISSIONS = {
  "calendar.read": ALL,
  "calendar.write": EDIT,
  "daily.swap": EDIT,
  /** Daily Five scheduler (R2-05): see and preview the days; pick, re-pick, lock and import them. */
  "dailyFive.read": ALL,
  "dailyFive.write": EDIT,
  "content.read": EDIT,
  "content.write": EDIT,
  "content.approve": EDIT,
  "content.owner_review": ["owner"],
  "moderation.read": MOD,
  "moderation.write": MOD,
  /** R2-13: the join-approval log for under-16 hosts' friends-only rooms (who asked, host, room, outcome, time). */
  "joinlog.read": MOD,
  "liveops.read": ["owner", "analyst", "moderator", "content_editor"],
  "flags.read": ["owner", "content_editor", "analyst"],
  "flags.write": ["owner"],
  "settings.read": ["owner", "content_editor", "analyst"],
  "settings.write": ["owner"],
  "catalog.read": ["owner", "content_editor", "analyst"],
  "catalog.write": EDIT,
  "prices.write": ["owner"],
  "events.read": ["owner", "content_editor", "analyst"],
  "events.write": EDIT,
  "metrics.read": ["owner", "analyst", "content_editor"],
  "audit.read": ["owner", "analyst"],
  "team.manage": ["owner"],
  /** Players (owner request): list, detail and overview totals. */
  "players.read": ["owner", "moderator", "analyst"],
  /** Personal data: full email in the list, detail and export, and search by email. Everyone else sees it masked. */
  "players.pii": ["owner"],
  /** Reset nickname, ban (timed or not) and unban, revoke or restore ranking, grant a streak freeze, force sign-out. */
  "players.moderate": MOD,
  /** Grant or remove Sparks (bounded to ±10,000 per action). */
  "players.economy": ["owner"],
  /** See and correct a player's birth month and year (the age rules follow it). Players can never change it. */
  "players.age": MOD,
  /** Delete an account for good (the player's own deletion path). */
  "players.delete": ["owner"],
  /** CSV export of the player list. */
  "players.export": ["owner"],
  /** R4-02: feedback from the /contact form: list, filter and CSV export (the email masked without players.pii). */
  "feedback.read": ["owner", "moderator", "content_editor", "analyst"],
  /** Mark feedback read or done (audited). */
  "feedback.write": MOD,
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
