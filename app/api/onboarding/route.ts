import { suggestCampusOption } from "@/lib/campus/service";
import { completeOnboardingWithAliasRetry } from "@/lib/onboarding/service";
import { onboardingSchema } from "@/lib/onboarding/validation";
import { createClient } from "@/lib/supabase/server";
import { suggestStudyProgramOption } from "@/lib/study-program/service";
import {
  encryptVerificationValue,
  fingerprintNim,
} from "@/lib/verification/crypto";
import { normalizeNim } from "@/lib/verification/validation";
import { NextResponse, type NextRequest } from "next/server";

const MAX_REQUEST_BYTES = 12_288;
const GENERIC_ERROR =
  "Onboarding belum dapat disimpan. Periksa isian dan coba lagi.";

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return NextResponse.json({ message: GENERIC_ERROR }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { message: "Sesi kamu telah berakhir. Silakan masuk kembali." },
      { status: 401 },
    );
  }

  try {
    const normalizedNim = parsed.data.nim
      ? normalizeNim(parsed.data.nim)
      : null;
    const encryptedNim = normalizedNim
      ? encryptVerificationValue(normalizedNim)
      : null;

    await completeOnboardingWithAliasRetry(
      parsed.data,
      async (alias, input, policyVersion) => {
        const { error } = await supabase.rpc("complete_student_onboarding_v2", {
          p_public_alias: alias,
          p_first_name: input.firstName,
          p_last_name: input.lastName,
          p_nim_ciphertext: encryptedNim?.ciphertext ?? null,
          p_nim_iv: encryptedNim?.iv ?? null,
          p_nim_auth_tag: encryptedNim?.authTag ?? null,
          p_nim_last_four: normalizedNim?.slice(-4) ?? null,
          p_nim_fingerprint: normalizedNim
            ? fingerprintNim(normalizedNim)
            : null,
          p_campus: input.campus,
          p_study_program: input.studyProgram,
          p_degree_level: input.degreeLevel,
          p_semester: input.semester,
          p_city_region: input.cityRegion,
          p_short_intro: input.shortIntro,
          p_interests: input.interests,
          p_connection_goals: input.connectionGoals,
          p_online_first: input.preferences.onlineFirst,
          p_group_first: input.preferences.groupFirst,
          p_verified_users_only: input.preferences.verifiedUsersOnly,
          p_same_campus_preferred: input.preferences.sameCampusPreferred,
          p_cross_campus_allowed: input.preferences.crossCampusAllowed,
          p_policy_version: policyVersion,
          p_terms_accepted: input.consents.terms,
          p_privacy_accepted: input.consents.privacy,
          p_community_guidelines_accepted:
            input.consents.communityGuidelines,
        });

        return { error };
      },
    );

    await Promise.allSettled([
      suggestCampusOption(parsed.data.campus),
      suggestStudyProgramOption(parsed.data.studyProgram),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: GENERIC_ERROR }, { status: 500 });
  }
}
