import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildEarlyAccessReviewEmail, type EarlyAccessReviewEmailKind } from "@/lib/email/early-access-review-template";
import { isStudyDateEmailConfigured, sendStudyDateEmail } from "@/lib/email/mailer";
import { STUDYDATE_EMAIL_LOGO_CID } from "@/lib/email/magic-link-template";

const EMAIL_LOGO_PATH = join(process.cwd(), "public/brand/logo-horizontal-color.png");

function loadLogo() {
  try {
    return readFileSync(EMAIL_LOGO_PATH);
  } catch {
    return null;
  }
}

export async function deliverEarlyAccessReviewEmail(input: {
  email: string;
  kind: EarlyAccessReviewEmailKind;
  reasonCodes: string[];
  userNote?: string | null;
  actionUrl?: string | null;
  origin: string;
}) {
  if (!isStudyDateEmailConfigured()) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  const logo = loadLogo();
  const logoSrc = logo
    ? `cid:${STUDYDATE_EMAIL_LOGO_CID}`
    : new URL("/brand/logo-horizontal-color.png", input.origin).toString();
  const template = buildEarlyAccessReviewEmail({
    kind: input.kind,
    reasonCodes: input.reasonCodes,
    userNote: input.userNote,
    actionUrl: input.actionUrl,
    logoSrc,
  });

  await sendStudyDateEmail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    inlineAttachments: logo
      ? [{
          filename: "logo-horizontal-color.png",
          content: logo,
          contentId: STUDYDATE_EMAIL_LOGO_CID,
          contentType: "image/png",
        }]
      : undefined,
  });
}
