/**
 * Whether an auth user is a test account that may be deleted after a run: an anonymous guest with no email, or an
 * address on the reserved .test top-level domain (RFC 2606: never a real mailbox), such as the test admins'
 * `@admin.test`. Real accounts never match.
 *
 * @param {{ is_anonymous?: boolean, email?: string | null }} user
 */
export function isTestAccount(user) {
  if (user.is_anonymous && !user.email) return true;
  return /@[a-z0-9.-]+\.test$/i.test(user.email ?? "");
}
