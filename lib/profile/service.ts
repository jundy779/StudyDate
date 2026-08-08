import "server-only";

import { getMyStudentSocialContacts } from "@/lib/profile/social-service";
import type {
  EditableStudentProfile,
  ProfileUpdateInput,
} from "@/lib/profile/validation";
import { createClient } from "@/lib/supabase/server";

export type { EditableStudentProfile };

type ProfileRow = {
  public_alias: string;
  first_name: string;
  last_name: string | null;
  campus: string;
  study_program: string;
  degree_level: string;
  semester: number | null;
  city_region: string | null;
  short_intro: string | null;
  interests: string[] | null;
  connection_goals: string[] | null;
  avatar_mascot: string | null;
  is_discoverable: boolean;
  verification_status: string;
};

export async function getEditableStudentProfile(
  userId: string,
): Promise<EditableStudentProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "public_alias, first_name, last_name, campus, study_program, degree_level, semester, city_region, short_intro, interests, connection_goals, avatar_mascot, is_discoverable, verification_status",
    )
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error || !data) {
    return null;
  }

  const social = await getMyStudentSocialContacts(userId);

  return {
    publicAlias: data.public_alias,
    firstName: data.first_name,
    lastName: data.last_name,
    campus: data.campus,
    studyProgram: data.study_program,
    degreeLevel: data.degree_level,
    semester: data.semester,
    cityRegion: data.city_region,
    shortIntro: data.short_intro,
    interests: data.interests ?? [],
    connectionGoals: data.connection_goals ?? [],
    avatarMascot: data.avatar_mascot,
    isDiscoverable: data.is_discoverable,
    verificationStatus: data.verification_status,
    linkedinUrl: social.linkedinUrl,
    instagramUsername: social.instagramUsername,
  };
}

export async function updateMyStudentProfile(input: ProfileUpdateInput) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_student_profile", {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_campus: input.campus,
    p_study_program: input.studyProgram,
    p_degree_level: input.degreeLevel,
    p_semester: input.semester,
    p_city_region: input.cityRegion,
    p_short_intro: input.shortIntro,
    p_interests: input.interests,
    p_connection_goals: input.connectionGoals,
    p_avatar_mascot: input.avatarMascot,
    p_is_discoverable: input.isDiscoverable,
  });

  if (error) {
    if (error.message?.includes("linkedin required")) {
      throw new Error("LINKEDIN_REQUIRED");
    }
    throw new Error("Profile update failed.");
  }
}
