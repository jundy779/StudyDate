import { supabase } from "@/lib/supabase";
import type {
  DiscoveryProfile,
  IntroductionEligibility,
  IntroductionEligibilityState,
  IntroductionListItem,
  IntroductionStatus,
  StudyStatus,
} from "@/features/social/types";

const PAGE_SIZE = 12;
const aliasPattern = /^Partner #[0-9]{6}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const introductionStatuses = new Set<IntroductionStatus>([
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "expired",
]);
const studyStatuses = new Set<StudyStatus>([
  "study_friend",
  "discussion_friend",
  "project_friend",
]);
const eligibilityStates = new Set<IntroductionEligibilityState>([
  "ok",
  "self",
  "unavailable",
  "pending",
  "cooldown",
  "rate_limited",
  "quota_reached",
  "blocked",
]);

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toDiscoveryProfile(value: unknown): DiscoveryProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const publicAlias = stringValue(row.public_alias);
  if (!aliasPattern.test(publicAlias)) return null;

  const studyStatus = stringValue(row.study_status);
  return {
    public_alias: publicAlias,
    campus: stringValue(row.campus, "Kampus belum ditampilkan"),
    study_program: stringValue(row.study_program, "Program studi belum ditampilkan"),
    semester: typeof row.semester === "number" ? row.semester : null,
    city_region: optionalString(row.city_region),
    short_intro: optionalString(row.short_intro),
    interests: stringArray(row.interests),
    connection_goals: stringArray(row.connection_goals),
    is_verified: row.is_verified === true,
    study_status: studyStatuses.has(studyStatus as StudyStatus)
      ? (studyStatus as StudyStatus)
      : null,
    study_status_expires_at: optionalString(row.study_status_expires_at),
  };
}

function toIntroduction(value: unknown): IntroductionListItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const requestId = stringValue(row.request_id);
  const counterpartAlias = stringValue(row.counterpart_alias);
  const status = stringValue(row.status) as IntroductionStatus;
  if (!uuidPattern.test(requestId) || !aliasPattern.test(counterpartAlias) || !introductionStatuses.has(status)) {
    return null;
  }

  return {
    request_id: requestId,
    counterpart_alias: counterpartAlias,
    campus: stringValue(row.campus, "Kampus belum ditampilkan"),
    study_program: stringValue(row.study_program, "Program studi belum ditampilkan"),
    semester: typeof row.semester === "number" ? row.semester : null,
    is_verified: row.is_verified === true,
    opening_message: stringValue(row.opening_message),
    status,
    created_at: stringValue(row.created_at),
    responded_at: optionalString(row.responded_at),
  };
}

function requireClient() {
  if (!supabase) throw new Error("Koneksi aplikasi belum disiapkan.");
  return supabase;
}

function mapSocialError(message: string | undefined) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("quota")) return "Batas penggunaan harianmu sudah terpakai.";
  if (text.includes("onboarding")) return "Selesaikan profilmu di website sebelum memakai Cari Teman.";
  if (text.includes("contact disclosure")) {
    return "Simpan informasi kontak untuk nanti. Kenalan dulu lewat chat StudyDate.";
  }
  if (text.includes("rate limited") || text.includes("cooldown") || text.includes("duplicate")) {
    return "Kamu sudah mengirim beberapa perkenalan. Coba lagi nanti.";
  }
  if (text.includes("invalid opening")) return "Tulis perkenalan singkat antara 12 sampai 300 karakter.";
  return "Fitur ini belum dapat diproses. Coba lagi sebentar.";
}

export async function listPeople(after: string | null = null) {
  const client = requireClient();
  const { data, error } = await client.rpc("list_people_discovery_profiles", {
    p_campus: null,
    p_study_program: null,
    p_semester: null,
    p_city_region: null,
    p_connection_goal: null,
    p_interest: null,
    p_after_alias: after,
    p_limit: PAGE_SIZE + 1,
  });

  if (error) throw new Error(mapSocialError(error.message));
  const rows = (Array.isArray(data) ? data : [])
    .map(toDiscoveryProfile)
    .filter((item): item is DiscoveryProfile => item !== null);
  const hasMore = rows.length > PAGE_SIZE;
  const profiles = rows.slice(0, PAGE_SIZE);
  return {
    profiles,
    nextCursor: hasMore ? profiles.at(-1)?.public_alias ?? null : null,
  };
}

export async function getIntroductionEligibility(alias: string) {
  const client = requireClient();
  const { data, error } = await client.rpc("get_introduction_send_eligibility", {
    p_recipient_alias: alias,
  });
  if (error) return { can_send: false, state_code: "unavailable" } satisfies IntroductionEligibility;

  const row = Array.isArray(data) && data[0] && typeof data[0] === "object"
    ? (data[0] as Record<string, unknown>)
    : null;
  const state = stringValue(row?.state_code) as IntroductionEligibilityState;
  if (!row || !eligibilityStates.has(state)) {
    return { can_send: false, state_code: "unavailable" };
  }
  return { can_send: row.can_send === true, state_code: state };
}

export async function sendIntroduction(alias: string, message: string) {
  const client = requireClient();
  const { error } = await client.rpc("send_introduction_request", {
    p_recipient_alias: alias,
    p_opening_message: message,
  });
  if (error) throw new Error(mapSocialError(error.message));
}

async function listIntroductions(direction: "received" | "sent") {
  const client = requireClient();
  const functionName = direction === "received"
    ? "list_received_introduction_requests"
    : "list_sent_introduction_requests";
  const { data, error } = await client.rpc(functionName, { p_limit: 50 });
  if (error) throw new Error(mapSocialError(error.message));
  return (Array.isArray(data) ? data : [])
    .map(toIntroduction)
    .filter((item): item is IntroductionListItem => item !== null);
}

export function listReceivedIntroductions() {
  return listIntroductions("received");
}

export function listSentIntroductions() {
  return listIntroductions("sent");
}

async function updateIntroduction(functionName: string, requestId: string) {
  const client = requireClient();
  const { error } = await client.rpc(functionName, { p_request_id: requestId });
  if (error) throw new Error(mapSocialError(error.message));
}

export function acceptIntroduction(requestId: string) {
  return updateIntroduction("accept_introduction_request", requestId);
}

export function declineIntroduction(requestId: string) {
  return updateIntroduction("decline_introduction_request", requestId);
}

export function cancelIntroduction(requestId: string) {
  return updateIntroduction("cancel_introduction_request", requestId);
}
