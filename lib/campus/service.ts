import "server-only";

import {
  mergeCampusLabels,
  SEED_CAMPUS_LABELS,
} from "@/lib/onboarding/options/campuses";
import type { OnboardingOption } from "@/lib/onboarding/options/shared";
import { createClient } from "@/lib/supabase/server";

const campusNameCollator = new Intl.Collator("id-ID", {
  sensitivity: "base",
  numeric: true,
});

function compareCampusName(left: string, right: string) {
  return campusNameCollator.compare(left, right);
}
export type CampusOptionStatus = "approved" | "pending" | "rejected";
export type CampusOptionSource = "seed" | "manual" | "staff";

export type StaffCampusOption = {
  id: string;
  name: string;
  searchKey: string;
  status: CampusOptionStatus;
  source: CampusOptionSource;
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
  status: CampusOptionStatus;
  source: CampusOptionSource;
  suggestion_count: number;
  last_suggested_at: string;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  suggested_by_suffix: string | null;
  reviewed_by_suffix: string | null;
};

export async function loadApprovedCampusOptions(): Promise<
  readonly OnboardingOption[]
> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("list_approved_campus_options");
    if (error) {
      return mergeCampusLabels(SEED_CAMPUS_LABELS);
    }

    const names = ((data ?? []) as ApprovedRow[])
      .map((row) => row.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (!names.length) {
      return mergeCampusLabels(SEED_CAMPUS_LABELS);
    }

    return mergeCampusLabels(SEED_CAMPUS_LABELS, names);
  } catch {
    return mergeCampusLabels(SEED_CAMPUS_LABELS);
  }
}

/** After onboarding: record campus for staff curation if new/manual. */
export async function suggestCampusOption(name: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("suggest_campus_option", {
    p_name: name,
  });
  if (error) {
    throw new Error("Campus suggestion failed.");
  }
}

export async function listStaffCampusOptions(status?: CampusOptionStatus) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_staff_campus_options", {
    p_status: status ?? null,
    p_limit: 300,
  });
  if (error) {
    throw new Error("Campus catalog unavailable.");
  }

  return ((data ?? []) as StaffRow[])
    .map(
      (row): StaffCampusOption => ({
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
    .sort((left, right) => compareCampusName(left.name, right.name));
}

export async function manageCampusOption(input: {
  action: "create" | "update" | "approve" | "reject" | "delete";
  id?: string | null;
  name?: string | null;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("manage_campus_option", {
    p_action: input.action,
    p_id: input.id ?? null,
    p_name: input.name ?? null,
  });
  if (error) {
    throw new Error("Campus manage failed.");
  }
  return data as string;
}
