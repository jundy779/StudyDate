import { CONNECTION_GOALS, INTERESTS } from "../onboarding/constants.ts";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().max(120).optional(),
);

const allowedGoals = CONNECTION_GOALS.map((goal) => goal.value);
const allowedInterests = INTERESTS.map((interest) => interest.value);

export const peopleFiltersSchema = z.object({
  campus: optionalText,
  program: optionalText,
  semester: z.preprocess(
    (value) => (typeof value === "string" && value ? Number(value) : undefined),
    z.number().int().min(1).max(16).optional(),
  ),
  city: optionalText,
  goal: z.enum(allowedGoals).optional(),
  interest: z.enum(allowedInterests).optional(),
  after: z.preprocess(
    (value) => (typeof value === "string" && value ? value : undefined),
    z.string().regex(/^Partner #[0-9]{6}$/).optional(),
  ),
});

export const peopleAliasSchema = z.string().regex(/^Partner #[0-9]{6}$/);

export type PeopleFilters = z.infer<typeof peopleFiltersSchema>;

export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePeopleFilters(
  searchParams: Record<string, string | string[] | undefined>,
) {
  return peopleFiltersSchema.safeParse({
    campus: firstSearchValue(searchParams.campus),
    program: firstSearchValue(searchParams.program),
    semester: firstSearchValue(searchParams.semester),
    city: firstSearchValue(searchParams.city),
    goal: firstSearchValue(searchParams.goal),
    interest: firstSearchValue(searchParams.interest),
    after: firstSearchValue(searchParams.after),
  });
}
