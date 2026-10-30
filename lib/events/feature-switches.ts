import "server-only";

import { cache } from "react";

import { isStudyDateEmailConfigured } from "@/lib/email/mailer";
import { createClient } from "@/lib/supabase/server";

/**
 * Fitur acara memakai dua lapis saklar:
 * 1. Izin teknis di env Vercel (EVENT_BLAST_ENABLED, EVENT_EMAIL_ENABLED), diisi sekali saat
 *    infrastruktur siap. Juga berfungsi sebagai pemutus darurat.
 * 2. Saklar Owner di /owner/events (tabel platform_settings, migration 202610300002).
 * Fitur hanya jalan bila keduanya menyala. Kalau saklar Owner belum terpasang, dianggap mati.
 */

export type EventFeatureKey = "event_blast_enabled" | "event_email_enabled";

export function eventBlastPermitted() {
  return process.env.EVENT_BLAST_ENABLED === "true";
}

export function eventEmailEnvPermitted() {
  return process.env.EVENT_EMAIL_ENABLED === "true";
}

export function eventEmailServiceReady() {
  return isStudyDateEmailConfigured();
}

export function serviceRoleReady() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Satu kali per request. available=false berarti migration 202610300002 belum terpasang. */
export const getEventFeatureSwitches = cache(async () => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_event_feature_switches");
    if (error) return { available: false, blast: false, email: false };
    const row = (Array.isArray(data) ? data[0] : data) as
      | { event_blast: boolean; event_email: boolean }
      | undefined;
    return {
      available: Boolean(row),
      blast: row?.event_blast === true,
      email: row?.event_email === true,
    };
  } catch {
    return { available: false, blast: false, email: false };
  }
});

export async function isEventBlastEnabled() {
  if (!eventBlastPermitted()) return false;
  return (await getEventFeatureSwitches()).blast;
}

/** Email pengumuman butuh pengumuman aktif, izin env, layanan email, service role, dan saklar Owner. */
export async function isEventEmailEnabled() {
  if (!eventEmailEnvPermitted() || !eventEmailServiceReady() || !serviceRoleReady()) return false;
  if (!(await isEventBlastEnabled())) return false;
  return (await getEventFeatureSwitches()).email;
}

export async function getEventFeatureReadiness() {
  const switches = await getEventFeatureSwitches();
  return {
    switchesAvailable: switches.available,
    blastOn: switches.blast,
    emailOn: switches.email,
    blastPermitted: eventBlastPermitted(),
    emailEnvPermitted: eventEmailEnvPermitted(),
    emailServiceReady: eventEmailServiceReady(),
    serviceRoleReady: serviceRoleReady(),
  };
}

export async function ownerSetEventFeatureSwitch(key: EventFeatureKey, enabled: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("owner_set_event_feature_switch", {
    p_key: key,
    p_enabled: enabled,
  });
  if (error) throw new Error("Saklar belum dapat disimpan.");
  return data === true;
}
