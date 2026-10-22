import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";

export type PrivateProfile = {
  public_alias: string;
  first_name: string;
  campus: string;
  study_program: string;
  semester: number | null;
  interests: string[];
  connection_goals: string[];
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  onboarding_completed_at: string | null;
  deactivated_at: string | null;
};

/**
 * Dicache per request (React `cache`). Satu halaman sering memanggil ini dari layout, halaman, dan
 * pemeriksaan akses; tanpa cache, setiap panggilan berarti satu perjalanan ke Supabase Auth.
 */
export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});
export async function getPrivateProfile(
  userId: string,
): Promise<PrivateProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "public_alias, first_name, campus, study_program, semester, interests, connection_goals, verification_status, onboarding_completed_at, deactivated_at",
    )
    .eq("user_id", userId)
    .maybeSingle<PrivateProfile>();

  if (error) {
    return null;
  }

  return data;
}
