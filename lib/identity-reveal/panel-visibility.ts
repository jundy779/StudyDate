import type { IdentityRevealState } from "@/lib/identity-reveal/constants";

export const EMPTY_IDENTITY_REVEAL_STATE: IdentityRevealState = {
  eligible: false,
  hasProfile: false,
  selectedByMe: false,
  completed: false,
  completedAt: null,
  canWithdraw: false,
};

/** Normalize possibly-missing client state without inventing counterpart fields. */
export function normalizeIdentityRevealState(
  state: IdentityRevealState | null | undefined,
): IdentityRevealState {
  if (!state) {
    return { ...EMPTY_IDENTITY_REVEAL_STATE };
  }

  return {
    eligible: Boolean(state.eligible),
    hasProfile: Boolean(state.hasProfile),
    selectedByMe: Boolean(state.selectedByMe),
    completed: Boolean(state.completed),
    completedAt: state.completedAt ? String(state.completedAt) : null,
    canWithdraw: Boolean(state.canWithdraw),
  };
}

/**
 * Client visibility only. Authorization remains on the server (RPC/media proxy).
 * Allows rendering when Mutual Interest completed, or when safe current-user
 * reveal state already indicates eligibility/progress (hydration/poll desync).
 */
export function isIdentityRevealPanelAvailable(input: {
  mutualCompleted: boolean;
  state: IdentityRevealState | null | undefined;
}): boolean {
  const state = normalizeIdentityRevealState(input.state);
  return (
    Boolean(input.mutualCompleted) ||
    state.eligible ||
    state.hasProfile ||
    state.selectedByMe ||
    state.completed
  );
}

/** Completed counterpart media must not render without a counterpart name. */
export function canShowCounterpartRevealMedia(input: {
  completed: boolean;
  counterpartFirstName: string | null | undefined;
}): boolean {
  return Boolean(input.completed && input.counterpartFirstName);
}
