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
  "content.read": EDIT,
  "content.write": EDIT,
  "content.approve": EDIT,
  "content.owner_review": ["owner"],
  "moderation.read": MOD,
  "moderation.write": MOD,
  "schools.read": MOD,
  "schools.write": MOD,
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
  /** Delete an account for good (the player's own deletion path). */
  "players.delete": ["owner"],
  /** CSV export of the player list. */
  "players.export": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
