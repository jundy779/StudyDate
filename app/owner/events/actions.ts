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
