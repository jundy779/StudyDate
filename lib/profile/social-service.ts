import "server-only";

import type {
  ProfileSocialContactsInput,
  StudentSocialContacts,
} from "@/lib/profile/social-validation";
import { createClient } from "@/lib/supabase/server";

type SocialRow = {
  linkedin_url: string;
  instagram_username: string | null;
};

export async function getMyStudentSocialContacts(
  userId: string,
): Promise<StudentSocialContacts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_social_contacts")
    .select("linkedin_url, instagram_username")
    .eq("user_id", userId)
    .maybeSingle<SocialRow>();

  if (error || !data) {
    return { linkedinUrl: null, instagramUsername: null };
  }

  return {
    linkedinUrl: data.linkedin_url,
    instagramUsername: data.instagram_username,
  };
}

export async function upsertMyStudentSocialContacts(
  input: ProfileSocialContactsInput,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_my_student_social_contacts", {
    p_linkedin_url: input.linkedinUrl,
    p_instagram_username: input.instagramUsername,
  });

  if (error) {
    throw new Error("Social contacts update failed.");
  }
}
