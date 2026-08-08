import "server-only";

import {
  mergeStudyProgramLabels,
  SEED_STUDY_PROGRAM_LABELS,
} from "@/lib/onboarding/options/study-programs";
import type { OnboardingOption } from "@/lib/onboarding/options/shared";
import { createClient } from "@/lib/supabase/server";

export type StudyProgramOptionStatus = "approved" | "pending" | "rejected";
export type StudyProgramOptionSource = "seed" | "manual" | "staff";

export type StaffStudyProgramOption = {
  id: string;
  name: string;
  searchKey: string;
  status: StudyProgramOptionStatus;
  source: StudyProgramOptionSource;
  suggestionCount: number;
  lastSuggestedAt: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  suggestedBySuffix: string | null;
  reviewedBySuffix: string | null;
};

type ApprovedRow = {
  name: string;
  search_key: string;
};

type StaffRow = {
  id: string;
  name: string;
  search_key: string;
  status: StudyProgramOptionStatus;
  source: StudyProgramOptionSource;
  suggestion_count: number;
  last_suggested_at: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  suggested_by_suffix: string | null;
  reviewed_by_suffix: string | null;
};

const nameCollator = new Intl.Collator("id-ID", {
  sensitivity: "base",
  numeric: true,
});

export async function loadApprovedStudyProgramOptions(): Promise<
  readonly OnboardingOption[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "list_approved_study_program_options",
    );
    if (error) {
      return mergeStudyProgramLabels(SEED_STUDY_PROGRAM_LABELS);
    }

    const names = ((data ?? []) as ApprovedRow[])
      .map((row) => row.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (!names.length) {
      return mergeStudyProgramLabels(SEED_STUDY_PROGRAM_LABELS);
    }

    return mergeStudyProgramLabels(SEED_STUDY_PROGRAM_LABELS, names);
  } catch {
    return mergeStudyProgramLabels(SEED_STUDY_PROGRAM_LABELS);
  }
}

export async function suggestStudyProgramOption(name: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("suggest_study_program_option", {
    p_name: name,
  });
  if (error) {
    throw new Error("Study program suggestion failed.");
  }
}

export async function listStaffStudyProgramOptions(
  status?: StudyProgramOptionStatus,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_staff_study_program_options",
    {
      p_status: status ?? null,
      p_limit: 300,
    },
  );
  if (error) {
    throw new Error("Study program catalog unavailable.");
  }

  return ((data ?? []) as StaffRow[])
    .map(
      (row): StaffStudyProgramOption => ({
        id: row.id,
        name: row.name,
        searchKey: row.search_key,
        status: row.status,
        source: row.source,
        suggestionCount: row.suggestion_count,
        lastSuggestedAt: row.last_suggested_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        reviewedAt: row.reviewed_at,
        suggestedBySuffix: row.suggested_by_suffix,
        reviewedBySuffix: row.reviewed_by_suffix,
      }),
    )
    .sort((left, right) => nameCollator.compare(left.name, right.name));
}

export async function manageStudyProgramOption(input: {
  action: "create" | "update" | "approve" | "reject" | "delete";
  id?: string | null;
  name?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("manage_study_program_option", {
    p_action: input.action,
    p_id: input.id ?? null,
    p_name: input.name ?? null,
  });
  if (error) {
    throw new Error("Study program manage failed.");
  }
  return data as string;
}
