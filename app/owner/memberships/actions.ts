"use server";

import { requireOwner } from "@/lib/staff/authorization";
import { manageMembershipByEmail } from "@/lib/membership/service";
import {
  billingOfferSchema,
  membershipEmailLookupSchema,
  membershipGrantSchema,
  membershipRevokeSchema,
} from "@/lib/membership/validation";
import { saveOwnerBillingOffer } from "@/lib/billing/service";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function lookupMembership(formData: FormData) {
  await requireOwner();
  const parsed = membershipEmailLookupSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) redirect("/owner/memberships?state=invalid");
  redirect(
    `/owner/memberships?email=${encodeURIComponent(parsed.data.email)}`,
  );
}

export async function grantPlusMembership(formData: FormData) {
  await requireOwner();
  const parsed = membershipGrantSchema.safeParse({
    email: formData.get("email"),
    durationDays: formData.get("durationDays"),
  });
  if (!parsed.success) redirect("/owner/memberships?state=invalid");
  const result = await manageMembershipByEmail(
    parsed.data.email,
    "grant_plus",
    parsed.data.durationDays,
  );
  revalidatePath("/owner/memberships");
  if (result === "not_found") redirect("/owner/memberships?state=not_found");
  if (result === "error") redirect("/owner/memberships?state=error");
  redirect(
    `/owner/memberships?email=${encodeURIComponent(parsed.data.email)}&state=saved`,
  );
}

export async function revokePlusMembership(formData: FormData) {
  await requireOwner();
  const parsed = membershipRevokeSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) redirect("/owner/memberships?state=invalid");
  const result = await manageMembershipByEmail(
    parsed.data.email,
    "revoke_plus",
  );
  revalidatePath("/owner/memberships");
  if (result === "not_found") redirect("/owner/memberships?state=not_found");
  if (result === "unchanged") redirect("/owner/memberships?state=unchanged");
  if (result === "error") redirect("/owner/memberships?state=error");
  redirect(
    `/owner/memberships?email=${encodeURIComponent(parsed.data.email)}&state=saved`,
  );
}

export async function updateBillingOffer(formData: FormData) {
  await requireOwner();
  const parsed = billingOfferSchema.safeParse({
    packageCode: formData.get("packageCode"),
    amountIdr: formData.get("amountIdr"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) redirect("/owner/memberships?state=invalid");
  try {
    await saveOwnerBillingOffer(parsed.data);
  } catch {
    redirect("/owner/memberships?state=error");
  }
  revalidatePath("/owner/memberships");
  revalidatePath("/app/membership");
  redirect(
    `/owner/memberships?state=offer_saved&package=${encodeURIComponent(parsed.data.packageCode)}`,
  );
}
