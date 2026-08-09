import type { EditableStudentProfile } from "@/lib/profile/validation";

export type ProfileCompletenessItem = {
  id: string;
  label: string;
  done: boolean;
};

export function getProfileCompletenessItems(
  profile: Pick<
    EditableStudentProfile,
    | "campus"
    | "studyProgram"
    | "cityRegion"
    | "shortIntro"
    | "interests"
    | "connectionGoals"
    | "avatarMascot"
    | "isDiscoverable"
    | "linkedinUrl"
    | "instagramUsername"
  >,
): ProfileCompletenessItem[] {
  return [
    {
      id: "basics",
      label: "Kampus & program studi",
      done: Boolean(
        profile.campus?.trim() &&
          profile.studyProgram?.trim(),
      ),
    },
    {
      id: "linkedin",
      label: "LinkedIn (wajib untuk People)",
      done: Boolean(profile.linkedinUrl?.trim()),
    },
    {
      id: "instagram",
      label: "Instagram (opsional)",
      done: Boolean(profile.instagramUsername?.trim()),
    },
    {
      id: "city",
      label: "Kota / wilayah",
      done: Boolean(profile.cityRegion?.trim()),
    },
    {
      id: "intro",
      label: "Intro singkat",
      done: Boolean(profile.shortIntro?.trim()),
    },
    {
      id: "goals",
      label: "Tujuan koneksi",
      done: (profile.connectionGoals?.length ?? 0) >= 1,
    },
    {
      id: "interests",
      label: "Minat",
      done: (profile.interests?.length ?? 0) >= 1,
    },
    {
      id: "mascot",
      label: "Maskot People",
      done: Boolean(profile.avatarMascot),
    },
    {
      id: "discoverable",
      label: "Tampil di People",
      done: profile.isDiscoverable,
    },
  ];
}

export function countCompletedProfileItems(
  items: ProfileCompletenessItem[],
) {
  return items.filter((item) => item.done).length;
}
