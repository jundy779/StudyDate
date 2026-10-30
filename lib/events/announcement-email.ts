import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getConfiguredSiteOrigin } from "@/lib/auth/site-url";
import { buildEventAnnouncementEmail } from "@/lib/email/event-announcement-template";
import { STUDYDATE_EMAIL_LOGO_CID } from "@/lib/email/magic-link-template";
import { isStudyDateEmailConfigured, sendStudyDateEmail } from "@/lib/email/mailer";
import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BATCH_SIZE = 50;
// Kapasitas acara paling besar 200 peserta, jadi 5 x 50 sudah cukup untuk satu pengumuman.
const MAX_BATCHES = 5;
const EMAIL_LOGO_PATH = join(process.cwd(), "public/brand/logo-horizontal-color.png");

/**
 * Email pengumuman hanya aktif kalau saklar server menyala, layanan email siap,
 * dan kunci service role tersedia untuk membaca alamat penerima.
 */
export function isEventEmailEnabled() {
  return (
    process.env.EVENT_EMAIL_ENABLED === "true" &&
    isStudyDateEmailConfigured() &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

function mapEmailError(message: string) {
  if (message.includes("already requested")) return "Email untuk pengumuman ini sudah pernah dikirim.";
  if (message.includes("window closed")) return "Email hanya bisa dikirim untuk pengumuman yang dibuat kurang dari sehari.";
  if (message.includes("rate limited")) return "Batas email pengumuman hari ini sudah tercapai. Coba lagi besok.";
  if (message.includes("management required")) return "Kamu tidak punya izin mengirim email untuk acara ini.";
  return "Email pengumuman belum dapat dikirim.";
}

export async function queueAnnouncementEmail(announcementPublicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_campus_event_announcement_email", {
    p_announcement_public_id: announcementPublicId,
  });
  if (error) throw new Error(mapEmailError(error.message));
  return Number(data ?? 0);
}

export async function retryAnnouncementEmail(announcementPublicId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retry_campus_event_announcement_email", {
    p_announcement_public_id: announcementPublicId,
  });
  if (error) throw new Error(mapEmailError(error.message));
  return Number(data ?? 0);
}

export type AnnouncementEmailCounts = {
  emailRequested: boolean;
  sent: number;
  pending: number;
  failed: number;
};

/** Hanya angka. Penyelenggara tidak pernah melihat alamat email peserta. */
export async function listAnnouncementEmailCounts(publicSlug: string) {
  const counts = new Map<string, AnnouncementEmailCounts>();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campus_event_announcement_email_counts", {
    p_public_slug: publicSlug,
  });
  if (error) return counts;
  for (const row of (data ?? []) as Array<{
    announcement_public_id: string;
    email_requested: boolean;
    sent_count: number;
    pending_count: number;
    failed_count: number;
  }>) {
    counts.set(row.announcement_public_id, {
      emailRequested: row.email_requested,
      sent: Number(row.sent_count),
      pending: Number(row.pending_count),
      failed: Number(row.failed_count),
    });
  }
  return counts;
}

function loadLogo() {
  try {
    return readFileSync(EMAIL_LOGO_PATH);
  } catch {
    return null;
  }
}

type ClaimedDelivery = {
  delivery_id: string;
  recipient_email: string;
  unsubscribe_token: string;
  event_title: string;
  event_public_slug: string;
  event_starts_at: string;
  event_timezone: string;
  announcement_title: string;
  announcement_body: string;
};

/**
 * Mengirim antrean email satu pengumuman. Alamat dibaca lewat service role dan tidak
 * pernah dikembalikan ke halaman. Setiap baris diklaim dengan sewa 5 menit, jadi
 * pemanggilan ganda tidak mengirim email yang sama dua kali.
 */
export async function deliverAnnouncementEmails(announcementPublicId: string) {
  const result = { sent: 0, failed: 0 };
  if (!isEventEmailEnabled()) return result;
  const admin = createServerAdminClient();
  if (!admin) return result;

  const origin = getConfiguredSiteOrigin();
  const logo = loadLogo();
  const logoSrc = logo
    ? `cid:${STUDYDATE_EMAIL_LOGO_CID}`
    : new URL("/brand/logo-horizontal-color.png", origin).toString();

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data, error } = await admin.rpc("claim_campus_event_email_batch", {
      p_announcement_public_id: announcementPublicId,
      p_limit: BATCH_SIZE,
    });
    if (error) break;
    const rows = (data ?? []) as ClaimedDelivery[];
    if (rows.length === 0) break;

    const sentIds: string[] = [];
    const failedIds: string[] = [];
    for (const row of rows) {
      const eventUrl = new URL(`/app/events/${encodeURIComponent(row.event_public_slug)}`, origin);
      eventUrl.hash = "event-announcements";
      const unsubscribeUrl = new URL("/email/berhenti", origin);
      unsubscribeUrl.searchParams.set("token", row.unsubscribe_token);
      const template = buildEventAnnouncementEmail({
        eventTitle: row.event_title,
        eventStartsAt: row.event_starts_at,
        eventTimezone: row.event_timezone,
        announcementTitle: row.announcement_title,
        announcementBody: row.announcement_body,
        eventUrl: eventUrl.toString(),
        unsubscribeUrl: unsubscribeUrl.toString(),
        logoSrc,
      });
      try {
        await sendStudyDateEmail({
          to: row.recipient_email,
          subject: template.subject,
          text: template.text,
          html: template.html,
          headers: { "List-Unsubscribe": `<${unsubscribeUrl.toString()}>` },
          inlineAttachments: logo
            ? [{
                filename: "logo-horizontal-color.png",
                content: logo,
                contentId: STUDYDATE_EMAIL_LOGO_CID,
                contentType: "image/png",
              }]
            : undefined,
        });
        sentIds.push(row.delivery_id);
      } catch {
        failedIds.push(row.delivery_id);
      }
    }

    if (sentIds.length) {
      await admin.rpc("complete_campus_event_email_deliveries", {
        p_delivery_ids: sentIds,
        p_status: "sent",
      });
    }
    if (failedIds.length) {
      await admin.rpc("complete_campus_event_email_deliveries", {
        p_delivery_ids: failedIds,
        p_status: "failed",
      });
    }
    result.sent += sentIds.length;
    result.failed += failedIds.length;
    if (rows.length < BATCH_SIZE) break;
  }
  return result;
}

export async function getMyEventEmailPreference() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_event_email_preference");
  if (error) return null;
  return data !== false;
}

export async function setMyEventEmailPreference(enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_event_email_preference", { p_enabled: enabled });
  if (error) throw new Error("Pilihan email belum dapat disimpan.");
}

export async function unsubscribeEventEmail(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const admin = createServerAdminClient();
  if (!admin) return false;
  const { data, error } = await admin.rpc("unsubscribe_event_announcement_email", { p_token: token });
  if (error) return false;
  return data === true;
}
