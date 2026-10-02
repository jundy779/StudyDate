import "server-only";

import { PEOPLE_PAGE_SIZE } from "@/lib/people/constants";
import type { StudyStatus } from "@/lib/people/study-status";
import type { PeopleFilters } from "@/lib/people/validation";
import { createClient } from "@/lib/supabase/server";

export type DiscoveryProfile = {
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  city_region: string | null;
  short_intro: string | null;
  interests: string[];
  connection_goals: string[];
  is_verified: boolean;
  study_status: StudyStatus | null;
  study_status_expires_at: string | null;
};

export type OwnStudyStatus = {
  supported: boolean;
  study_status: StudyStatus | null;
  expires_at: string | null;
};

export type PeoplePage = {
  profiles: DiscoveryProfile[];
  nextCursor: string | null;
};

export async function listDiscoveryProfiles(
  filters: PeopleFilters,
): Promise<PeoplePage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_people_discovery_profiles", {
    p_campus: filters.campus ?? null,
    p_study_program: filters.program ?? null,
    p_semester: filters.semester ?? null,
    p_city_region: filters.city ?? null,
    p_connection_goal: filters.goal ?? null,
    p_interest: filters.interest ?? null,
    p_after_alias: filters.after ?? null,
    p_limit: PEOPLE_PAGE_SIZE + 1,
  });

  if (error) {
    const text = (error.message ?? "").toLowerCase();
    if (text.includes("quota")) {
      throw new Error("discovery quota reached");
    }
    throw new Error("Cari Teman sedang tidak tersedia.");
  }

  const rows = (data ?? []) as DiscoveryProfile[];
  const hasMore = rows.length > PEOPLE_PAGE_SIZE;
  const profiles = rows.slice(0, PEOPLE_PAGE_SIZE);

  return {
    profiles,
    nextCursor: hasMore ? profiles.at(-1)?.public_alias ?? null : null,
  };
}

export async function getDiscoveryProfile(alias: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_people_discovery_profile", {
    p_public_alias: alias,
  });

  if (error) {
    throw new Error("Profil belum dapat dibuka.");
  }

  return ((data ?? [])[0] as DiscoveryProfile | undefined) ?? null;
}

export async function getOwnDiscoveryVisibility(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("is_discoverable")
    .eq("user_id", userId)
    .maybeSingle<{ is_discoverable: boolean }>();

  if (error || !data) {
    throw new Error("Pengaturan Cari Teman belum dapat dimuat.");
  }

  return data.is_discoverable;
}

export async function setOwnDiscoveryVisibility(isDiscoverable: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_people_discovery_visibility", {
    p_is_discoverable: isDiscoverable,
  });

  if (error) {
    throw new Error("Pengaturan Cari Teman belum dapat diperbarui.");
  }
}


export async function getOwnStudyStatus(): Promise<OwnStudyStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_study_status");

  if (error) {
    const message = (error.message ?? "").toLowerCase();
    const capabilityMissing =
      message.includes("get_my_study_status") &&
      (message.includes("does not exist") ||
        message.includes("schema cache") ||
        message.includes("could not find"));
    if (capabilityMissing) {
      return { supported: false, study_status: null, expires_at: null };
    }
    throw new Error("Status belajarmu belum dapat dimuat.");
  }

  const row = ((data ?? [])[0] ?? null) as
    | { study_status: StudyStatus | null; expires_at: string | null }
    | null;
  return {
    supported: true,
    study_status: row?.study_status ?? null,
    expires_at: row?.expires_at ?? null,
  };
}

export async function setOwnStudyStatus(status: StudyStatus | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_study_status", {
    p_status: status,
  });

  if (error) {
    throw new Error("Status belajarmu belum dapat diperbarui.");
  }
}
