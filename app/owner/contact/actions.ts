"use server";

import { requireOwner } from "@/lib/staff/authorization";
import { ownerSaveContactLink } from "@/lib/marketing/contact-links";
import {
  CONTACT_LINK_KINDS,
  isAllowedContactUrl,
  type ContactLinkKind,
} from "@/lib/marketing/contact-links-config";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function saveContactLinkAction(formData: FormData) {
  await requireOwner();
  const kind = String(formData.get("kind") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const isVisible = formData.get("isVisible") === "on";

  if (!(CONTACT_LINK_KINDS as readonly string[]).includes(kind)) {
    redirect("/owner/contact?state=invalid");
  }
  const contactKind = kind as ContactLinkKind;
  if (url && !isAllowedContactUrl(contactKind, url)) {
    redirect(`/owner/contact?state=bad_url&kind=${contactKind}#${contactKind}`);
  }

  const ok = await ownerSaveContactLink(contactKind, url, isVisible);
  revalidatePath("/owner/contact");
  revalidatePath("/", "layout");
  redirect(`/owner/contact?state=${ok ? (url ? "saved" : "removed") : "failed"}&kind=${contactKind}#${contactKind}`);
}
