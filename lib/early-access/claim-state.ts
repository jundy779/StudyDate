import type { EarlyAccessSource } from "@/lib/early-access/validation";

export const earlyAccessClaimOutcomes = [
  "not_waitlisted",
  "claimed_now",
  "already_claimed_by_self",
  "already_claimed_other",
  "not_eligible",
] as const;

export type EarlyAccessClaimOutcome = (typeof earlyAccessClaimOutcomes)[number];

export type EarlyAccessInterestHint = "people" | "groups" | "events";

export type EarlyAccessClaimPrefill = {
  campus: string | null;
  interestHints: EarlyAccessInterestHint[];
};

export type EarlyAccessClaimResult = {
  outcome: EarlyAccessClaimOutcome;
  prefill: EarlyAccessClaimPrefill | null;
  /** Sanitized client/UX flag — never includes waitlist id, email, or source. */
  earlyAccessClaimed: boolean;
  /** Show welcome-back copy only when claim succeeded or was already self. */
  showWelcomeBack: boolean;
  /** Rare conflict — generic support message, no ownership details. */
  showConflictSupport: boolean;
};

export type EarlyAccessOnboardingPrefill = {
  campus: string;
  preferences: {
    groupFirst: boolean;
  };
  connectionGoals: string[];
  earlyAccessClaimed: boolean;
};

type ClaimRpcPayload = {
  outcome?: string;
  prefill?: {
    campus?: string | null;
    interestHints?: unknown;
  } | null;
};

const INTEREST_HINTS = new Set<EarlyAccessInterestHint>([
  "people",
  "groups",
  "events",
]);

export function sanitizeInterestHints(
  value: unknown,
): EarlyAccessInterestHint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const hints: EarlyAccessInterestHint[] = [];
  for (const item of value) {
    if (
      typeof item === "string" &&
      INTEREST_HINTS.has(item as EarlyAccessInterestHint) &&
      !hints.includes(item as EarlyAccessInterestHint)
    ) {
      hints.push(item as EarlyAccessInterestHint);
    }
  }
  return hints;
}

export function sanitizeClaimPrefill(
  value: ClaimRpcPayload["prefill"],
): EarlyAccessClaimPrefill | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const campus =
    typeof value.campus === "string" && value.campus.trim()
      ? value.campus.trim().slice(0, 120)
      : null;

  return {
    campus,
    interestHints: sanitizeInterestHints(value.interestHints),
  };
}

export function isClaimOutcome(
  value: string,
): value is EarlyAccessClaimOutcome {
  return (earlyAccessClaimOutcomes as readonly string[]).includes(value);
}

export function parseClaimRpcPayload(data: unknown): EarlyAccessClaimResult {
  if (!data || typeof data !== "object") {
    return toClientClaimState("not_eligible", null);
  }

  const payload = data as ClaimRpcPayload;
  const outcome =
    typeof payload.outcome === "string" && isClaimOutcome(payload.outcome)
      ? payload.outcome
      : "not_eligible";

  return toClientClaimState(outcome, sanitizeClaimPrefill(payload.prefill));
}

export function mapEarlyAccessHintsToOnboarding(
  prefill: EarlyAccessClaimPrefill | null,
): Omit<EarlyAccessOnboardingPrefill, "earlyAccessClaimed"> | null {
  if (!prefill) {
    return null;
  }

  const connectionGoals: string[] = [];
  const hints = new Set(prefill.interestHints);

  // Early Access interests are CTA categories, not profile topic interests.
  // Map only to soft onboarding preferences/goals — never into profiles.interests.
  if (hints.has("people")) {
    connectionGoals.push("friendship");
  }
  if (hints.has("events")) {
    connectionGoals.push("campus_activities");
  }

  return {
    campus: (prefill.campus ?? "").trim().slice(0, 120),
    preferences: {
      groupFirst: hints.has("groups"),
    },
    connectionGoals,
  };
}

export function toClientClaimState(
  outcome: EarlyAccessClaimOutcome,
  prefill: EarlyAccessClaimPrefill | null,
): EarlyAccessClaimResult {
  const claimed =
    outcome === "claimed_now" || outcome === "already_claimed_by_self";

  return {
    outcome,
    prefill: claimed ? prefill : null,
    earlyAccessClaimed: claimed,
    showWelcomeBack: claimed,
    showConflictSupport: outcome === "already_claimed_other",
  };
}

export function buildOnboardingPrefillFromClaim(
  claim: EarlyAccessClaimResult,
): EarlyAccessOnboardingPrefill | null {
  if (!claim.earlyAccessClaimed) {
    return null;
  }

  const mapped = mapEarlyAccessHintsToOnboarding(claim.prefill);
  if (!mapped) {
    return {
      campus: "",
      preferences: { groupFirst: false },
      connectionGoals: [],
      earlyAccessClaimed: true,
    };
  }

  return {
    ...mapped,
    earlyAccessClaimed: true,
  };
}

/**
 * In-memory uniqueness model for concurrent claim attempts on one waitlist row.
 * Mirrors DB invariants: one claimed_user_id per row; first writer wins.
 */
export function simulateConcurrentWaitlistClaims(
  waitlistEmail: string,
  attempts: ReadonlyArray<{ userId: string; email: string }>,
): { winners: string[]; outcomes: EarlyAccessClaimOutcome[] } {
  const normalized = waitlistEmail.trim().toLowerCase();
  let claimedBy: string | null = null;
  const outcomes: EarlyAccessClaimOutcome[] = [];

  for (const attempt of attempts) {
    const email = attempt.email.trim().toLowerCase();
    if (email !== normalized) {
      outcomes.push("not_waitlisted");
      continue;
    }
    if (claimedBy === attempt.userId) {
      outcomes.push("already_claimed_by_self");
      continue;
    }
    if (claimedBy !== null) {
      outcomes.push("already_claimed_other");
      continue;
    }
    claimedBy = attempt.userId;
    outcomes.push("claimed_now");
  }

  return {
    winners: claimedBy ? [claimedBy] : [],
    outcomes,
  };
}

/** Source stays internal acquisition metadata — never returned to browser. */
export type InternalEarlyAccessAttribution = {
  source: EarlyAccessSource | null;
};
