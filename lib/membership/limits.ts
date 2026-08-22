export const MEMBERSHIP_PLANS = ["free", "plus"] as const;

export type MembershipPlanCode = (typeof MEMBERSHIP_PLANS)[number];

export const MEMBERSHIP_LIMITS = {
  free: {
    peopleDiscoveryDaily: 10,
    introductionRequestsDaily: 3,
    activeIntroductions: 3,
    createdCirclesActive: 1,
    joinedCirclesActive: 3,
    createdEventsActive: 1,
    joinedEventsActive: 5,
    eventParticipantCapacity: 50,
    eventCohosts: 1,
    eventCustomQuestions: 3,
    advancedDiscoveryFilters: false,
  },
  plus: {
    peopleDiscoveryDaily: 40,
    introductionRequestsDaily: 10,
    activeIntroductions: 10,
    createdCirclesActive: 3,
    joinedCirclesActive: 10,
    createdEventsActive: 3,
    joinedEventsActive: 10,
    eventParticipantCapacity: 200,
    eventCohosts: 3,
    eventCustomQuestions: 10,
    advancedDiscoveryFilters: true,
  },
} as const;

export type MembershipLimits =
  (typeof MEMBERSHIP_LIMITS)[MembershipPlanCode];

export const MEMBERSHIP_GRANT_DAYS = [7, 30, 90] as const;

export type MembershipGrantDays = (typeof MEMBERSHIP_GRANT_DAYS)[number];

export const PLUS_PACKAGE_CODES = ["plus_7", "plus_30", "plus_90"] as const;

export const PLUS_PACKAGES = [
  { code: "plus_7", durationDays: 7, amountIdr: 9_000 },
  { code: "plus_30", durationDays: 30, amountIdr: 19_000 },
  { code: "plus_90", durationDays: 90, amountIdr: 49_000 },
] as const;

export type PlusPackageCode = (typeof PLUS_PACKAGE_CODES)[number];

export const MEMBERSHIP_DISPLAY_NAME: Record<MembershipPlanCode, string> = {
  free: "StudyDate Free",
  plus: "StudyDate Plus",
};

export function getMembershipLimits(
  plan: MembershipPlanCode,
): MembershipLimits {
  return MEMBERSHIP_LIMITS[plan];
}

export function isPlusPlan(plan: MembershipPlanCode): boolean {
  return plan === "plus";
}

export function hasEntitlement(
  plan: MembershipPlanCode,
  required: MembershipPlanCode,
): boolean {
  if (required === "free") return true;
  return plan === "plus";
}

export function canUseFeature(
  plan: MembershipPlanCode,
  feature: "advancedDiscoveryFilters",
): boolean {
  return MEMBERSHIP_LIMITS[plan][feature];
}
