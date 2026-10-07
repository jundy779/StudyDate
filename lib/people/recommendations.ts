import type { DiscoveryProfile } from "./service.ts";
import {
  buildSharedStudentContext,
  type StudentSocialProfile,
} from "./shared-context.ts";

type RecommendationSignals = {
  hasActiveStudyStatus: boolean;
  sharedGoalCount: number;
  sharedInterestCount: number;
  sameCampus: boolean;
  sameStudyProgram: boolean;
};

function signalsFor(
  ownProfile: StudentSocialProfile,
  profile: DiscoveryProfile,
): RecommendationSignals {
  const shared = buildSharedStudentContext(ownProfile, profile);
  return {
    hasActiveStudyStatus: profile.study_status !== null,
    sharedGoalCount: shared.sharedGoalKeys.length,
    sharedInterestCount: shared.sharedInterestKeys.length,
    sameCampus: shared.sameCampus,
    sameStudyProgram: shared.sameStudyProgram,
  };
}

function compareBoolean(left: boolean, right: boolean) {
  return Number(right) - Number(left);
}

export function sortDiscoveryProfilesBySharedContext(
  ownProfile: StudentSocialProfile,
  profiles: DiscoveryProfile[],
) {
  return [...profiles].sort((left, right) => {
    const leftSignals = signalsFor(ownProfile, left);
    const rightSignals = signalsFor(ownProfile, right);

    return (
      compareBoolean(
        leftSignals.hasActiveStudyStatus,
        rightSignals.hasActiveStudyStatus,
      ) ||
      rightSignals.sharedGoalCount - leftSignals.sharedGoalCount ||
      rightSignals.sharedInterestCount - leftSignals.sharedInterestCount ||
      compareBoolean(leftSignals.sameCampus, rightSignals.sameCampus) ||
      compareBoolean(
        leftSignals.sameStudyProgram,
        rightSignals.sameStudyProgram,
      ) ||
      left.public_alias.localeCompare(right.public_alias, "id-ID")
    );
  });
}
