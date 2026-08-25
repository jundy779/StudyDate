"use server";

import { deliverStudyDateMagicLink } from "@/lib/auth/magic-link-delivery";
import { getConfiguredSiteOrigin } from "@/lib/auth/site-url";
import { requireStaffCapability } from "@/lib/staff/authorization";
import {
  markEarlyAccessInvitationSent,
  prepareEarlyAccessInvitation,
  reviewEarlyAccessEntry,
} from "@/lib/staff/service";
import { earlyAccessReviewActionSchema } from "@/lib/staff/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function sendInvitation(email: string) {
  await deliverStudyDateMagicLink({
    email,
    origin: getConfiguredSiteOrigin(),
    nextPath: "/onboarding",
    kind: "early-access",
    allowCreateUser: true,
  });
  await markEarlyAccessInvitationSent(email);
}

function refreshEarlyAccessViews() {
  revalidatePath("/owner/early-access");
  revalidatePath("/staff/early-access");
  revalidatePath("/owner/audit");
}

export async function moderateEarlyAccess(formData: FormData) {
  await requireStaffCapability("early_access.review");

  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo =
    requestedReturnTo === "/owner/early-access"
      ? "/owner/early-access"
      : "/staff/early-access";
  const destination = (state: string) => `${returnTo}?state=${state}`;

  const parsed = earlyAccessReviewActionSchema.safeParse({
    email: formData.get("email"),
    action: formData.get("action"),
  });
  if (!parsed.success) {
    redirect(destination("invalid"));
  }

  const { email, action } = parsed.data;

  if (action === "reject") {
    try {
      await reviewEarlyAccessEntry({ email, decision: "reject" });
      refreshEarlyAccessViews();
    } catch {
      redirect(destination("review_error"));
    }
    redirect(destination("rejected"));
  }

  if (action === "resend") {
    let targetEmail: string;
    try {
      targetEmail = await prepareEarlyAccessInvitation(email);
      await sendInvitation(targetEmail);
      refreshEarlyAccessViews();
    } catch {
      redirect(destination("email_error"));
    }
    redirect(destination("resent"));
  }

  let approvedEmail: string;
  try {
    const reviewed = await reviewEarlyAccessEntry({
      email,
      decision: "approve",
    });
    approvedEmail = reviewed.email;
    refreshEarlyAccessViews();
  } catch {
    redirect(destination("review_error"));
  }

  try {
    await sendInvitation(approvedEmail);
    refreshEarlyAccessViews();
  } catch {
    // Approval remains authoritative. The queue shows invitation_sent_at=null
    // and lets an authorized reviewer retry without re-approving the entry.
    redirect(destination("approved_email_error"));
  }

  redirect(destination("approved"));
}
