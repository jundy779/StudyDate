import "server-only";

import type { CertificateBlocker } from "@/lib/events/after-rules";
import { mapCampusEventError } from "@/lib/events/service";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EventAfterState = {
  hasEnded: boolean;
  canGiveFeedback: boolean;
  feedbackClosesAt: string;
  feedback: { rating: number; comment: string | null; wouldAttendAgain: boolean | null } | null;
  certificate: {
    enabled: boolean;
    eligibility: "checked_in" | "registered" | null;
    requiresFeedback: boolean;
    blocker: CertificateBlocker | null;
    code: string | null;
    recipientName: string | null;
  };
  recap: { body: string; publishedAt: string; updatedAt: string } | null;
};

export type EventAfterSummary = {
  hasEnded: boolean;
  registeredCount: number;
  checkedInCount: number;
  feedbackCount: number;
  ratingAverage: number | null;
  ratingCounts: [number, number, number, number, number];
  wouldAttendAgainCount: number;
  certificateCount: number;
  certificateEnabled: boolean;
  certificateEligibility: "checked_in" | "registered";
  certificateRequiresFeedback: boolean;
  recapBody: string | null;
  recapPublishedAt: string | null;
};

export type MyCertificate = {
  verify_code: string;
  recipient_name: string;
  event_public_slug: string;
  event_title: string;
  event_starts_at: string;
  event_timezone: string;
  organizer_alias: string;
  is_official: boolean;
  attendance_basis: "checked_in" | "registered";
  issued_at: string;
};

export type VerifiedCertificate =
  | { status: "valid"; recipientName: string; eventTitle: string; eventStartsAt: string;
      eventTimezone: string; organizerAlias: string; isOfficial: boolean;
      attendanceBasis: "checked_in" | "registered"; issuedAt: string }
  | { status: "revoked" };

/** Migration 202610210004 belum terpasang: fitur dianggap belum ada, bukan error. */
function isMissingRpc(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
      (error.code === "PGRST202" ||
        error.code === "42883" ||
        /could not find the function/i.test(error.message ?? "")),
  );
}

export function mapEventAfterError(message?: string) {
  const value = (message ?? "").toLowerCase();
  if (value.includes("feedback unavailable")) {
    return "Ulasan hanya untuk peserta terdaftar, sampai 14 hari setelah acara selesai.";
  }
  if (value.includes("invalid feedback")) return "Periksa lagi nilai dan komentarmu.";
  if (value.includes("invalid recap")) return "Rekap harus 20 sampai 3000 karakter teks biasa.";
  if (value.includes("invalid certificate name")) {
    return "Tulis nama 2 sampai 80 huruf, tanpa angka atau simbol.";
  }
  if (value.includes("certificate unavailable")) {
    return "Sertifikat belum bisa diambil. Periksa syaratnya di halaman acara.";
  }
  if (value.includes("invalid certificate settings")) return "Pengaturan sertifikat tidak valid.";
  return mapCampusEventError(message);
}

export async function getMyEventAfterState(publicSlug: string): Promise<EventAfterState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_campus_event_after_state", {
    p_public_slug: publicSlug,
  });
  if (error) return null;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    hasEnded: Boolean(row.has_ended),
    canGiveFeedback: Boolean(row.can_give_feedback),
    feedbackClosesAt: String(row.feedback_closes_at),
    feedback:
      typeof row.feedback_rating === "number"
        ? {
            rating: row.feedback_rating,
            comment: (row.feedback_comment as string | null) ?? null,
            wouldAttendAgain: (row.feedback_would_attend_again as boolean | null) ?? null,
          }
        : null,
    certificate: {
      enabled: Boolean(row.certificate_enabled),
      eligibility: (row.certificate_eligibility as "checked_in" | "registered" | null) ?? null,
      requiresFeedback: Boolean(row.certificate_requires_feedback),
      blocker: (row.certificate_blocker as CertificateBlocker | null) ?? null,
      code: (row.certificate_code as string | null) ?? null,
      recipientName: (row.certificate_name as string | null) ?? null,
    },
    recap: row.recap_body
      ? {
          body: String(row.recap_body),
          publishedAt: String(row.recap_published_at),
          updatedAt: String(row.recap_updated_at),
        }
      : null,
  };
}

export async function getEventAfterSummary(publicSlug: string): Promise<EventAfterSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_campus_event_after_summary", {
    p_public_slug: publicSlug,
  });
  if (isMissingRpc(error)) return null;
  if (error) throw new Error(mapEventAfterError(error.message));
  const row = (data ?? [])[0] as Record<string, number | string | boolean | null> | undefined;
  if (!row) return null;
  const n = (key: string) => Number(row[key] ?? 0);
  return {
    hasEnded: Boolean(row.has_ended),
    registeredCount: n("registered_count"),
    checkedInCount: n("checked_in_count"),
    feedbackCount: n("feedback_count"),
    ratingAverage: row.rating_average === null ? null : Number(row.rating_average),
    ratingCounts: [n("rating_1"), n("rating_2"), n("rating_3"), n("rating_4"), n("rating_5")],
    wouldAttendAgainCount: n("would_attend_again_count"),
    certificateCount: n("certificate_count"),
    certificateEnabled: Boolean(row.certificate_enabled),
    certificateEligibility: row.certificate_eligibility === "registered" ? "registered" : "checked_in",
    certificateRequiresFeedback: Boolean(row.certificate_requires_feedback),
    recapBody: (row.recap_body as string | null) ?? null,
    recapPublishedAt: (row.recap_published_at as string | null) ?? null,
  };
}

export async function listEventFeedbackComments(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_feedback_comments", {
    p_public_slug: publicSlug,
  });
  if (error) return [];
  return (data ?? []) as { rating: number; comment: string; would_attend_again: boolean | null }[];
}

export async function listEventCertificateRecipients(publicSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_certificate_recipients", {
    p_public_slug: publicSlug,
  });
  if (error) return [];
  return (data ?? []) as {
    registration_public_id: string;
    public_alias: string;
    issued_at: string;
    revoked_by: "recipient" | "organizer" | null;
  }[];
}

export async function listMyPendingEventFeedback() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_pending_event_feedback", { p_limit: 5 });
  if (error) return [];
  return (data ?? []) as { public_slug: string; title: string; ends_at: string; timezone_name: string }[];
}

export async function listMyCertificates() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_campus_event_certificates");
  if (error) return [];
  return (data ?? []) as MyCertificate[];
}

/** Dipakai halaman publik /certificates/[code]. RPC ini memang boleh dipanggil anon. */
export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  const admin = createServerAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("verify_campus_event_certificate", {
    p_verify_code: code,
  });
  if (error) return null;
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  if (row.status !== "valid") return { status: "revoked" };
  return {
    status: "valid",
    recipientName: String(row.recipient_name),
    eventTitle: String(row.event_title),
    eventStartsAt: String(row.event_starts_at),
    eventTimezone: String(row.event_timezone),
    organizerAlias: String(row.organizer_alias),
    isOfficial: Boolean(row.is_official),
    attendanceBasis: row.attendance_basis === "registered" ? "registered" : "checked_in",
    issuedAt: String(row.issued_at),
  };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args);
  if (isMissingRpc(error)) throw new Error("Fitur ini belum tersedia. Coba lagi nanti.");
  if (error) throw new Error(mapEventAfterError(error.message));
  return data as unknown;
}

export const submitEventFeedback = (input: {
  publicSlug: string; rating: number; comment: string | null; wouldAttendAgain: boolean | null;
}) =>
  rpc("submit_campus_event_feedback", {
    p_public_slug: input.publicSlug,
    p_rating: input.rating,
    p_comment: input.comment,
    p_would_attend_again: input.wouldAttendAgain,
  });

export const setEventRecap = (publicSlug: string, body: string | null) =>
  rpc("set_campus_event_recap", { p_public_slug: publicSlug, p_body: body });

export const setEventCertificateSettings = (input: {
  publicSlug: string; enabled: boolean; eligibility: "checked_in" | "registered"; requiresFeedback: boolean;
}) =>
  rpc("set_campus_event_certificate_settings", {
    p_public_slug: input.publicSlug,
    p_enabled: input.enabled,
    p_eligibility: input.eligibility,
    p_requires_feedback: input.requiresFeedback,
  });

export async function claimEventCertificate(publicSlug: string, recipientName: string) {
  const code = await rpc("claim_campus_event_certificate", {
    p_public_slug: publicSlug,
    p_recipient_name: recipientName,
  });
  if (typeof code !== "string") throw new Error("Sertifikat belum bisa dibuat.");
  return code;
}

export const revokeMyCertificate = (code: string) =>
  rpc("revoke_my_campus_event_certificate", { p_verify_code: code });

export const revokeEventCertificate = (publicSlug: string, registrationPublicId: string) =>
  rpc("revoke_campus_event_certificate", {
    p_public_slug: publicSlug,
    p_registration_public_id: registrationPublicId,
  });
