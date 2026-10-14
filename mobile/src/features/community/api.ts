import { supabase } from "@/lib/supabase";
import type { CircleDetail, CircleSummary, EventDetail, EventQuestion, EventSummary } from "@/features/community/types";

const circleSlugPattern = /^circle-[0-9a-f]{24}$/;
const eventSlugPattern = /^event-[0-9a-f]{24}$/;

function client() {
  if (!supabase) throw new Error("Koneksi aplikasi belum disiapkan.");
  return supabase;
}

function message(error: unknown, fallback: string) {
  const value = error && typeof error === "object" && "message" in error ? String(error.message).toLowerCase() : "";
  if (value.includes("full")) return "Tempatnya sudah penuh.";
  if (value.includes("quota") || value.includes("limit")) return "Batas akunmu untuk fitur ini sudah terpakai.";
  if (value.includes("rate limited")) return "Aktivitasmu terlalu cepat. Tunggu sebentar, lalu coba lagi.";
  if (value.includes("unavailable") || value.includes("required")) return "Pilihan ini sudah tidak tersedia untuk akunmu.";
  return fallback;
}

export async function listCircles(search = "") {
  const { data, error } = await client().rpc("list_study_circles", {
    p_search: search.trim() || null, p_topic: null, p_scope: null,
    p_before_created_at: null, p_before_public_slug: null, p_limit: 30,
  });
  if (error) throw new Error(message(error, "Circle belum dapat dimuat."));
  return (Array.isArray(data) ? data : []) as CircleSummary[];
}

export async function getCircle(publicSlug: string) {
  if (!circleSlugPattern.test(publicSlug)) return null;
  const { data, error } = await client().rpc("get_study_circle", { p_public_slug: publicSlug });
  if (error) throw new Error(message(error, "Circle belum dapat dibuka."));
  return ((Array.isArray(data) ? data[0] : null) as CircleDetail | null) ?? null;
}

export async function changeCircleMembership(publicSlug: string, action: "join" | "leave") {
  if (!circleSlugPattern.test(publicSlug)) throw new Error("Circle tidak valid.");
  const rpc = action === "join" ? "join_study_circle" : "leave_study_circle";
  const { error } = await client().rpc(rpc, { p_public_slug: publicSlug });
  if (error) throw new Error(message(error, action === "join" ? "Belum dapat bergabung." : "Belum dapat keluar dari Circle."));
}

export async function listEvents(search = "") {
  const { data, error } = await client().rpc("list_campus_events", {
    p_search: search.trim() || null, p_category: null, p_scope: null,
    p_before_starts_at: null, p_before_public_slug: null, p_limit: 30,
  });
  if (error) throw new Error(message(error, "Acara belum dapat dimuat."));
  return (Array.isArray(data) ? data : []) as EventSummary[];
}

export async function getEvent(publicSlug: string) {
  if (!eventSlugPattern.test(publicSlug)) return null;
  const [detail, settings] = await Promise.all([
    client().rpc("get_campus_event", { p_public_slug: publicSlug }),
    client().rpc("get_campus_event_v2_settings", { p_public_slug: publicSlug }),
  ]);
  if (detail.error || settings.error) throw new Error(message(detail.error ?? settings.error, "Acara belum dapat dibuka."));
  const base = Array.isArray(detail.data) ? detail.data[0] : null;
  const extra = Array.isArray(settings.data) ? settings.data[0] : null;
  return base && extra ? ({ ...base, ...extra } as EventDetail) : null;
}

export async function listEventQuestions(publicSlug: string) {
  const { data, error } = await client().rpc("list_campus_event_registration_questions", { p_public_slug: publicSlug });
  if (error) throw new Error(message(error, "Pertanyaan pendaftaran belum dapat dimuat."));
  return (Array.isArray(data) ? data : []) as EventQuestion[];
}

export async function registerEvent(publicSlug: string) {
  const { data, error } = await client().rpc("register_for_campus_event", { p_public_slug: publicSlug, p_answers: {} });
  if (error) throw new Error(message(error, "Pendaftaran belum berhasil."));
  return Array.isArray(data) ? data[0] : null;
}

export async function cancelEventRegistration(publicSlug: string) {
  const { error } = await client().rpc("cancel_campus_event_rsvp", { p_public_slug: publicSlug });
  if (error) throw new Error(message(error, "Pendaftaran belum dapat dibatalkan."));
}
