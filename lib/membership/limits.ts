export const MEMBERSHIP_PLANS = ["free", "plus"] as const;

export type MembershipPlanCode = (typeof MEMBERSHIP_PLANS)[number];

export const MEMBERSHIP_LIMITS = {
  free: {
    peopleDiscoveryDaily: 10,
    introductionRequestsDaily: 3,
    activeIntroductions: 3,
    createdCirclesActive: 1,
    joinedCirclesActive: 3,
    advancedDiscoveryFilters: false,
  },
  plus: {
    peopleDiscoveryDaily: 40,
    introductionRequestsDaily: 10,
    activeIntroductions: 10,
    createdCirclesActive: 3,
    joinedCirclesActive: 10,
    advancedDiscoveryFilters: true,
  },
} as const;

export type MembershipLimits =
  (typeof MEMBERSHIP_LIMITS)[MembershipPlanCode];

export const MEMBERSHIP_GRANT_DAYS = [7, 30, 90] as const;

export type MembershipGrantDays = (typeof MEMBERSHIP_GRANT_DAYS)[number];

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
