"use server";

import {
  ownerManageEventOrganizerEligibility,
  ownerSetCampusEventOfficial,
} from "@/lib/events/service";
import {
  eventOfficialFlagSchema,
  eventOrganizerEligibilityLookupSchema,
  eventOrganizerEligibilityManageSchema,
} from "@/lib/events/validation";
import {
  getEventFeatureReadiness,
  ownerSetEventFeatureSwitch,
} from "@/lib/events/feature-switches";
import { requireOwner } from "@/lib/staff/authorization";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const ownerEventsPath = "/owner/events";

function redirectWithState(state: string, values: Record<string, string> = {}): never {
  const params = new URLSearchParams({ ...values, state });
  redirect(`${ownerEventsPath}?${params.toString()}`);
}

export async function lookupEventOrganizerEligibility(formData: FormData) {
  await requireOwner();
  const parsed = eventOrganizerEligibilityLookupSchema.safeParse({
    publicAlias: formData.get("publicAlias"),
  });
  if (!parsed.success) redirectWithState("invalid_alias");
  redirect(`${ownerEventsPath}?alias=${encodeURIComponent(parsed.data.publicAlias)}`);
}

export async function manageEventOrganizerEligibility(formData: FormData) {
  await requireOwner();
  const parsed = eventOrganizerEligibilityManageSchema.safeParse({
    publicAlias: formData.get("publicAlias"),
    action: formData.get("action"),
  });
  if (!parsed.success) redirectWithState("invalid_alias");

  let changed: boolean;
  try {
    changed = await ownerManageEventOrganizerEligibility(
      parsed.data.publicAlias,
      parsed.data.action,
    );
  } catch {
    redirectWithState("eligibility_error", { alias: parsed.data.publicAlias });
  }
  revalidatePath(ownerEventsPath);
  redirectWithState(changed ? "eligibility_saved" : "eligibility_unchanged", {
    alias: parsed.data.publicAlias,
  });
}

export async function setCampusEventOfficial(formData: FormData) {
  await requireOwner();
  const parsed = eventOfficialFlagSchema.safeParse({
    publicSlug: formData.get("publicSlug"),
    isOfficial: formData.get("isOfficial") === "true",
  });
  if (!parsed.success) redirectWithState("invalid_slug");

  let changed: boolean;
  try {
    changed = await ownerSetCampusEventOfficial(
      parsed.data.publicSlug,
      parsed.data.isOfficial,
    );
  } catch {
    redirectWithState("official_error", { slug: parsed.data.publicSlug });
  }
  revalidatePath(`/app/events/${parsed.data.publicSlug}`);
  revalidatePath("/events");
  revalidatePath(`/events/${parsed.data.publicSlug}`);
  redirectWithState(changed ? "official_saved" : "official_unchanged", {
    slug: parsed.data.publicSlug,
  });
}

/**
 * Saklar Owner untuk pengumuman dan email pengumuman acara. Menyalakan ditolak kalau izin
 * teknis (env, layanan email, service role) belum lengkap, supaya tidak gagal diam-diam.
 */
export async function setEventFeatureSwitchAction(formData: FormData) {
  await requireOwner();
  const key = formData.get("key");
  const value = formData.get("enabled");
  if ((key !== "event_blast_enabled" && key !== "event_email_enabled") || (value !== "true" && value !== "false")) {
    redirect(`${ownerEventsPath}?state=feature_error#fitur-acara`);
  }
  const enabled = value === "true";

  if (enabled) {
    const ready = await getEventFeatureReadiness();
    const blastReady = ready.switchesAvailable && ready.blastPermitted;
    const emailReady =
      blastReady && ready.blastOn && ready.emailEnvPermitted && ready.emailServiceReady && ready.serviceRoleReady;
    if ((key === "event_blast_enabled" && !blastReady) || (key === "event_email_enabled" && !emailReady)) {
      redirect(`${ownerEventsPath}?state=feature_not_ready#fitur-acara`);
    }
  }

  let changed: boolean;
  try {
    changed = await ownerSetEventFeatureSwitch(key, enabled);
  } catch {
    redirect(`${ownerEventsPath}?state=feature_error#fitur-acara`);
  }
  // Mematikan pengumuman ikut mematikan email, karena email menumpang pada pengumuman.
  if (key === "event_blast_enabled" && !enabled) {
    await ownerSetEventFeatureSwitch("event_email_enabled", false).catch(() => false);
  }
  revalidatePath(ownerEventsPath);
  revalidatePath("/owner/audit");
  redirect(`${ownerEventsPath}?state=${changed ? "feature_saved" : "feature_unchanged"}#fitur-acara`);
}
