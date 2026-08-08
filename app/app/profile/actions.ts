"use server";

import { updateMyStudentProfile } from "@/lib/profile/service";
import { upsertMyStudentSocialContacts } from "@/lib/profile/social-service";
import { profileSocialContactsSchema } from "@/lib/profile/social-validation";
import { profileUpdateSchema } from "@/lib/profile/validation";
import { revalidatePath } from "next/cache";

function readStringList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function saveStudentProfile(formData: FormData) {
  const semesterRaw = String(formData.get("semester") ?? "").trim();
  const socialParsed = profileSocialContactsSchema.safeParse({
    linkedinUrl: formData.get("linkedinUrl"),
    instagramUsername: formData.get("instagramUsername") || null,
  });

  if (!socialParsed.success) {
    return {
      ok: false as const,
      message:
        socialParsed.error.issues[0]?.message ??
        "Periksa LinkedIn / Instagram.",
    };
  }

  const parsed = profileUpdateSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    campus: formData.get("campus"),
    studyProgram: formData.get("studyProgram"),
    degreeLevel: formData.get("degreeLevel"),
    semester: semesterRaw === "" ? null : Number(semesterRaw),
    cityRegion: formData.get("cityRegion") || null,
    shortIntro: formData.get("shortIntro") || null,
    interests: readStringList(formData, "interests"),
    connectionGoals: readStringList(formData, "connectionGoals"),
    avatarMascot: formData.get("avatarMascot") || null,
    isDiscoverable: formData.get("isDiscoverable") === "true",
  });

  if (!parsed.success) {
    return { ok: false as const, message: "Periksa kembali isian profil." };
  }

  try {
    await upsertMyStudentSocialContacts(socialParsed.data);
    await updateMyStudentProfile(parsed.data);
  } catch (error) {
    if (error instanceof Error && error.message === "LINKEDIN_REQUIRED") {
      return {
        ok: false as const,
        message:
          "Isi LinkedIn dulu sebelum menampilkan profil di People. Instagram opsional.",
      };
    }
    return {
      ok: false as const,
      message: "Profil belum dapat disimpan. Coba lagi beberapa saat.",
    };
  }

  revalidatePath("/app");
  revalidatePath("/app/profile");
  revalidatePath("/app/people");
  return { ok: true as const };
}
