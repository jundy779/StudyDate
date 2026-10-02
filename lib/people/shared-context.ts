export type StudentSocialProfile = {
  campus: string;
  study_program: string;
  interests: string[] | null;
  connection_goals: string[] | null;
};

export type SharedStudentContext = {
  sharedInterestKeys: string[];
  sharedGoalKeys: string[];
  sameCampus: boolean;
  sameStudyProgram: boolean;
};

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

function uniqueSharedValues(
  left: string[] | null,
  right: string[] | null,
) {
  const rightValues = new Set((right ?? []).map(normalized));
  const seen = new Set<string>();

  return (left ?? []).filter((value) => {
    const key = normalized(value);
    if (!key || seen.has(key) || !rightValues.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildSharedStudentContext(
  ownProfile: StudentSocialProfile,
  otherProfile: StudentSocialProfile,
): SharedStudentContext {
  return {
    sharedInterestKeys: uniqueSharedValues(
      ownProfile.interests,
      otherProfile.interests,
    ),
    sharedGoalKeys: uniqueSharedValues(
      ownProfile.connection_goals,
      otherProfile.connection_goals,
    ),
    sameCampus:
      normalized(ownProfile.campus) === normalized(otherProfile.campus),
    sameStudyProgram:
      normalized(ownProfile.study_program) ===
      normalized(otherProfile.study_program),
  };
}

export function hasSharedStudentContext(context: SharedStudentContext) {
  return (
    context.sameCampus ||
    context.sameStudyProgram ||
    context.sharedInterestKeys.length > 0 ||
    context.sharedGoalKeys.length > 0
  );
}
