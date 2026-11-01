/**
 * Onboarding funnel for the admin Metrics page: an anonymous first-party `onboarding_step` metric (kind = the
 * step) at each welcome step, and "home" when a new player first reaches Home. Same list as the API check
 * (POST /api/v1/metrics) and the SQL aggregation (private.admin_client_funnel).
 */
export const ONBOARDING_STEPS = ["hello", "signin", "age", "too_young", "start", "tutorial", "nickname", "home"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const isOnboardingStep = (s: unknown): s is OnboardingStep => (ONBOARDING_STEPS as readonly unknown[]).includes(s);

/** Welcome screen step ids to metric labels (labels are lower-case letters and underscores only). */
export function onboardingStepOf(step: string): OnboardingStep | null {
  const label = step === "under13" ? "too_young" : step;
  return isOnboardingStep(label) ? label : null;
}
