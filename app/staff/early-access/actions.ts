"use server";

import { createHash, randomBytes } from "node:crypto";

import { deliverStudyDateMagicLink } from "@/lib/auth/magic-link-delivery";
import { getConfiguredSiteOrigin } from "@/lib/auth/site-url";
import { deliverEarlyAccessReviewEmail } from "@/lib/email/early-access-review-delivery";
import { requireStaffCapability } from "@/lib/staff/authorization";
import {
  markEarlyAccessInvitationSent,
  prepareEarlyAccessInvitation,
  prepareEarlyAccessReminder,
  reviewEarlyAccessEntry,
} from "@/lib/staff/service";
import { earlyAccessReviewActionSchema } from "@/lib/staff/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const REVISION_LINK_TTL_DAYS = 7;

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

function makeRevisionToken() {
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

function revisionUrl(origin: string, token: string) {
  const url = new URL("/early-access/revise", origin);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function moderateEarlyAccess(formData: FormData) {
  await requireStaffCapability("early_access.review");

  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo =
    requestedReturnTo === "/owner/early-access"
      ? "/owner/early-access"
      : "/staff/early-access";
  // Lompat ke pesan hasil supaya terlihat walau tombol ada jauh di bawah.
  const destination = (state: string) => `${returnTo}?state=${state}#hasil-pemeriksaan`;

  const parsed = earlyAccessReviewActionSchema.safeParse({
    email: formData.get("email"),
    action: formData.get("action"),
    reasonCodes: formData.getAll("reasonCode"),
    userNote: formData.get("userNote") ?? "",
    internalNote: formData.get("internalNote") ?? "",
  });
  if (!parsed.success) {
    redirect(destination("invalid"));
  }

  const { email, action, reasonCodes, userNote, internalNote } = parsed.data;
  const origin = getConfiguredSiteOrigin();

  if (action === "reject") {
    let rejectedEmail: string;
    try {
      const reviewed = await reviewEarlyAccessEntry({
        email,
        decision: "reject",
        reasonCodes,
        userNote: userNote || null,
        internalNote: internalNote || null,
      });
      rejectedEmail = reviewed.email;
      refreshEarlyAccessViews();
    } catch {
      redirect(destination("review_error"));
    }

    try {
      await deliverEarlyAccessReviewEmail({
        email: rejectedEmail,
        kind: "rejected",
        reasonCodes,
        userNote: userNote || null,
        origin,
      });
    } catch {
      redirect(destination("rejected_email_error"));
    }

    redirect(destination("rejected"));
  }

  if (action === "needs_revision") {
    const token = makeRevisionToken();
    const expiresAt = new Date(
      Date.now() + REVISION_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    let targetEmail: string;

    try {
      const reviewed = await reviewEarlyAccessEntry({
        email,
        decision: "needs_revision",
        reasonCodes,
        userNote: userNote || null,
        internalNote: internalNote || null,
        revisionTokenHash: token.hash,
        revisionTokenExpiresAt: expiresAt,
      });
      targetEmail = reviewed.email;
      refreshEarlyAccessViews();
    } catch {
      redirect(destination("review_error"));
    }

    try {
      await deliverEarlyAccessReviewEmail({
        email: targetEmail,
        kind: "needs_revision",
        reasonCodes,
        userNote: userNote || null,
        actionUrl: revisionUrl(origin, token.raw),
        origin,
      });
    } catch {
      // Decision remains authoritative. Reviewer can submit "Minta perbaikan"
      // again to rotate the token and retry the email safely.
      redirect(destination("revision_email_error"));
    }

    redirect(destination("revision_requested"));
  }

  if (action === "remind") {
    let targetEmail: string;
    try {
      targetEmail = await prepareEarlyAccessReminder(email);
    } catch (error) {
      redirect(
        destination(
          error instanceof Error && error.message === "cooldown" ? "remind_cooldown" : "email_error",
        ),
      );
    }
    try {
      await sendInvitation(targetEmail);
      refreshEarlyAccessViews();
    } catch {
      redirect(destination("email_error"));
    }
    redirect(destination("reminded"));
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
