import assert from "node:assert/strict";
import test from "node:test";
import {
  canShowCounterpartRevealMedia,
  EMPTY_IDENTITY_REVEAL_STATE,
  isIdentityRevealPanelAvailable,
  normalizeIdentityRevealState,
} from "../lib/identity-reveal/panel-visibility.ts";

test("normalizeIdentityRevealState defaults missing state without counterpart fields", () => {
  const normalized = normalizeIdentityRevealState(undefined);
  assert.deepEqual(normalized, EMPTY_IDENTITY_REVEAL_STATE);
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized, "counterpartFirstName"),
    false,
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized, "selectedByOther"),
    false,
  );
});

test("normalizeIdentityRevealState coerces only safe current-user fields", () => {
  const normalized = normalizeIdentityRevealState({
    eligible: 1 as unknown as boolean,
    hasProfile: 0 as unknown as boolean,
    selectedByMe: true,
    completed: false,
    completedAt: "2026-08-06T00:00:00.000Z",
    canWithdraw: true,
  });
  assert.deepEqual(normalized, {
    eligible: true,
    hasProfile: false,
    selectedByMe: true,
    completed: false,
    completedAt: "2026-08-06T00:00:00.000Z",
    canWithdraw: true,
  });
});

test("panel stays hidden before mutual and without safe reveal progress", () => {
  assert.equal(
    isIdentityRevealPanelAvailable({
      mutualCompleted: false,
      state: EMPTY_IDENTITY_REVEAL_STATE,
    }),
    false,
  );
});

test("panel shows after mutual interest even with empty local reveal state", () => {
  assert.equal(
    isIdentityRevealPanelAvailable({
      mutualCompleted: true,
      state: EMPTY_IDENTITY_REVEAL_STATE,
    }),
    true,
  );
});

test("panel shows on hydration desync when mutual prop lags but eligible is true", () => {
  assert.equal(
    isIdentityRevealPanelAvailable({
      mutualCompleted: false,
      state: {
        ...EMPTY_IDENTITY_REVEAL_STATE,
        eligible: true,
      },
    }),
    true,
  );
});

test("panel shows completed state even if mutual prop is briefly false", () => {
  assert.equal(
    isIdentityRevealPanelAvailable({
      mutualCompleted: false,
      state: {
        ...EMPTY_IDENTITY_REVEAL_STATE,
        completed: true,
        completedAt: "2026-08-06T00:00:00.000Z",
      },
    }),
    true,
  );
});

test("counterpart media stays hidden without counterpart first name", () => {
  assert.equal(
    canShowCounterpartRevealMedia({
      completed: true,
      counterpartFirstName: null,
    }),
    false,
  );
  assert.equal(
    canShowCounterpartRevealMedia({
      completed: false,
      counterpartFirstName: "AuditAlpha",
    }),
    false,
  );
  assert.equal(
    canShowCounterpartRevealMedia({
      completed: true,
      counterpartFirstName: "AuditAlpha",
    }),
    true,
  );
});
