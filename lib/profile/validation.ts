import { CONNECTION_GOALS, INTERESTS } from "@/lib/onboarding/constants";
import { degreeLevels } from "@/lib/verification/validation";
import { z } from "zod";

export const PROFILE_MASCOT_OPTIONS = [
  "front",
  "hello",
  "chat",
  "study",
] as const;

export type ProfileMascot = (typeof PROFILE_MASCOT_OPTIONS)[number];

const goalValues = CONNECTION_GOALS.map((goal) => goal.value) as [
  (typeof CONNECTION_GOALS)[number]["value"],
  ...(typeof CONNECTION_GOALS)[number]["value"][],
];
const interestValues = INTERESTS.map((interest) => interest.value) as [
  (typeof INTERESTS)[number]["value"],
  ...(typeof INTERESTS)[number]["value"][],
];

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  campus: z.string().trim().min(2).max(120),
  studyProgram: z.string().trim().min(2).max(120),
  degreeLevel: z.enum(degreeLevels),
  semester: z.union([z.number().int().min(1).max(16), z.null()]),
  cityRegion: z
    .string()
    .trim()
    .max(120)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  shortIntro: z
    .string()
    .trim()
    .max(300)
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  interests: z
    .array(z.enum(interestValues))
    .min(1)
    .max(6)
    .transform((values) => [...new Set(values)]),
  connectionGoals: z
    .array(z.enum(goalValues))
    .min(1)
    .max(6)
    .transform((values) => [...new Set(values)]),
  avatarMascot: z.enum(PROFILE_MASCOT_OPTIONS).nullable(),
  isDiscoverable: z.boolean(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export type EditableStudentProfile = {
  publicAlias: string;
  firstName: string;
  lastName: string | null;
  campus: string;
  studyProgram: string;
  degreeLevel: string;
  semester: number | null;
  cityRegion: string | null;
  shortIntro: string | null;
  interests: string[];
  connectionGoals: string[];
  avatarMascot: string | null;
  isDiscoverable: boolean;
  verificationStatus: string;
  linkedinUrl: string | null;
  instagramUsername: string | null;
};

export function mascotImageSrc(mascot: string | null | undefined) {
  if (
    mascot &&
    (PROFILE_MASCOT_OPTIONS as readonly string[]).includes(mascot)
  ) {
    return `/brand/mascot/${mascot}.png`;
  }
  return null;
}
