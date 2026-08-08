import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildMagicLinkEmail,
  STUDYDATE_EMAIL_LOGO_CID,
} from "@/lib/email/magic-link-template";
import {
  isStudyDateEmailConfigured,
  sendStudyDateEmail,
} from "@/lib/email/mailer";
import { createServerAdminClient } from "@/lib/supabase/admin";

const EMAIL_LOGO_PATH = join(
  process.cwd(),
  "public/brand/logo-horizontal-color.png",
);

function loadStudyDateEmailLogo() {
  try {
    return readFileSync(EMAIL_LOGO_PATH);
  } catch {
    return null;
  }
}

export type DeliverMagicLinkInput = {
  email: string;
  origin: string;
  nextPath: "/app" | "/staff";
  kind: "student" | "staff";
  /** Student login may create Auth users; staff login must not. */
  allowCreateUser: boolean;
};

async function authUserExists(email: string) {
  const admin = createServerAdminClient();
  if (!admin) return false;

  const normalized = email.trim().toLowerCase();
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) return false;
    const users = data.users ?? [];
    if (
      users.some((user) => (user.email ?? "").trim().toLowerCase() === normalized)
    ) {
      return true;
    }
    if (users.length < 200) break;
  }
  return false;
}

/**
 * Creates a magic-link token via Supabase Admin API only (no Auth mailer),
 * then delivers a StudyDate-branded email from StudyDate ID infrastructure.
 */
export async function deliverStudyDateMagicLink(input: DeliverMagicLinkInput) {
  if (!isStudyDateEmailConfigured()) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  const admin = createServerAdminClient();
  if (!admin) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  if (!input.allowCreateUser) {
    const exists = await authUserExists(input.email);
    if (!exists) {
      throw new Error("StudyDate email delivery is unavailable.");
    }
  }

  const redirectTo = new URL("/auth/callback", input.origin);
  redirectTo.searchParams.set("next", input.nextPath);

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: input.email,
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data?.properties?.hashed_token) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  const confirmUrl = new URL("/auth/confirm", input.origin);
  confirmUrl.searchParams.set("token_hash", data.properties.hashed_token);
  confirmUrl.searchParams.set("type", "email");
  confirmUrl.searchParams.set("next", input.nextPath);

  const logo = loadStudyDateEmailLogo();
  const logoSrc = logo
    ? `cid:${STUDYDATE_EMAIL_LOGO_CID}`
    : new URL("/brand/logo-horizontal-color.png", input.origin).toString();

  const template = buildMagicLinkEmail({
    kind: input.kind,
    confirmUrl: confirmUrl.toString(),
    logoSrc,
  });

  await sendStudyDateEmail({
    to: input.email,
    subject: template.subject,
    text: template.text,
    html: template.html,
    inlineAttachments: logo
      ? [
          {
            filename: "logo-horizontal-color.png",
            content: logo,
            contentId: STUDYDATE_EMAIL_LOGO_CID,
            contentType: "image/png",
          },
        ]
      : undefined,
  });
}
