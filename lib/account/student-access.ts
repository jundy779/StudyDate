import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isSchoolEmail } from "@/lib/auth/allowed-email-domains";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { getCurrentStaffAccess } from "@/lib/staff/authorization";
import { createClient } from "@/lib/supabase/server";

export type StudentAccountTier = "student" | "school";

export type StudentAccess = {
  tier: StudentAccountTier;
  verificationRequired: boolean;
  verificationStatus: "unverified" | "pending" | "verified" | "rejected";
  socialAllowed: boolean;
  eventsAllowed: boolean;
};

/** Menu yang tidak dipakai akun sekolah. */
export const SCHOOL_HIDDEN_NAV_KEYS = [
  "people",
  "circles",
  "introductions",
  "messages",
] as const;

/**
 * Kategori acara yang boleh diikuti akun sekolah. Harus sama dengan
 * public.is_educational_event_category di migration 202610200001.
 */
export const EDUCATIONAL_EVENT_CATEGORIES = [
  "study_together",
  "coding_tech",
  "design",
  "languages",
  "exam_prep",
  "workshop",
  "seminar",
] as const;

export function isEducationalEventCategory(category: string | null | undefined) {
  return (EDUCATIONAL_EVENT_CATEGORIES as readonly string[]).includes(category ?? "");
}

type AccessRow = {
  account_tier: string;
  verification_required: boolean;
  verification_status: StudentAccess["verificationStatus"];
  social_features_allowed: boolean;
  events_allowed: boolean;
};

function isMissingRpc(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("could not find the function")
  );
}

/**
 * Status akses mahasiswa yang sedang masuk. Database tetap penegak utama;
 * fungsi ini hanya untuk tampilan dan pengalihan halaman.
 *
 * Sebelum migration 202610200001 terpasang, RPC belum ada. Saat itu jenis akun
 * dibaca dari domain email dan verifikasi dianggap belum diwajibkan, sama
 * dengan perilaku database lama.
 */
export const getMyStudentAccess = cache(async (): Promise<StudentAccess | null> => {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_student_access");

  if (error) {
    if (!isMissingRpc(error)) return null;
    const school = isSchoolEmail(user.email);
    return {
      tier: school ? "school" : "student",
      verificationRequired: false,
      verificationStatus: "unverified",
      socialAllowed: !school,
      eventsAllowed: true,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as AccessRow | undefined;
  if (!row) return null;

  return {
    tier: row.account_tier === "school" ? "school" : "student",
    verificationRequired: Boolean(row.verification_required),
    verificationStatus: row.verification_status,
    socialAllowed: Boolean(row.social_features_allowed),
    eventsAllowed: Boolean(row.events_allowed),
  };
});

async function isStaffUser() {
  const user = await getAuthenticatedUser();
  return user ? Boolean(await getCurrentStaffAccess(user)) : false;
}

/** Halaman Cari Teman, Perkenalan, Pesan, dan Circle. */
export async function requireSocialFeatureAccess() {
  if (await isStaffUser()) return;
  const access = await getMyStudentAccess();
  if (!access || access.socialAllowed) return;
  if (access.tier === "school") {
    redirect("/app/events?akses=sekolah");
  }
  redirect("/app/verification?wajib=1");
}

/** Halaman Acara. */
export async function requireEventFeatureAccess() {
  if (await isStaffUser()) return;
  const access = await getMyStudentAccess();
  if (!access || access.eventsAllowed) return;
  redirect("/app/verification?wajib=1");
}
