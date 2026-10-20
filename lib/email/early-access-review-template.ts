import "server-only";

import { getEarlyAccessReviewReasonLabel } from "@/lib/early-access/review-reasons";

const BRAND_BLUE = "#014FE7";
const BRAND_NAVY = "#0F1B33";

export type EarlyAccessReviewEmailKind = "needs_revision" | "rejected";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildEarlyAccessReviewEmail(input: {
  kind: EarlyAccessReviewEmailKind;
  reasonCodes: string[];
  userNote?: string | null;
  actionUrl?: string | null;
  logoSrc: string;
}) {
  const needsRevision = input.kind === "needs_revision";
  const heading = needsRevision
    ? "Pendaftaranmu perlu diperbaiki"
    : "Update pendaftaran Early Access";
  const subject = needsRevision
    ? "Perbarui pendaftaran Early Access StudyDate"
    : "Update pendaftaran Early Access StudyDate";
  const lead = needsRevision
    ? "Kami sudah meninjau pendaftaran Early Access kamu. Sebelum akses dapat diberikan, ada beberapa informasi yang perlu diperbaiki."
    : "Terima kasih sudah tertarik mencoba StudyDate. Setelah ditinjau, saat ini kami belum dapat memberikan akses Early Access.";
  const labels = input.reasonCodes.map(getEarlyAccessReviewReasonLabel);
  const note = input.userNote?.trim() || null;

  const textLines = [
    "StudyDate ID",
    "",
    heading,
    "",
    lead,
    "",
    "Alasan:",
    ...labels.map((label) => `- ${label}`),
  ];
  if (note) textLines.push("", `Catatan: ${note}`);
  if (needsRevision && input.actionUrl) {
    textLines.push(
      "",
      "Perbarui pendaftaranmu melalui tautan aman berikut:",
      input.actionUrl,
      "",
      "Tautan ini hanya untuk pendaftaranmu dan akan kedaluarsa.",
    );
  }
  textLines.push("", "Tim StudyDate ID", "MEET • CONNECT • GROW");

  const reasonItems = labels
    .map(
      (label) =>
        `<li style="margin:0 0 8px 0;">${escapeHtml(label)}</li>`,
    )
    .join("");
  const noteHtml = note
    ? `<div style="margin-top:18px;padding:14px 16px;border-radius:12px;background:#F5F7FB;color:#4B5565;font-size:14px;line-height:1.6;"><strong style="color:${BRAND_NAVY};">Catatan dari tim StudyDate:</strong><br />${escapeHtml(note)}</div>`
    : "";
  const actionHtml =
    needsRevision && input.actionUrl
      ? `<p style="margin:26px 0 0 0;"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:12px;">Perbarui pendaftaran</a></p><p style="margin:18px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">Tautan perbaikan bersifat pribadi dan akan kedaluarsa. Jangan bagikan kepada orang lain.</p>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND_NAVY};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F7FB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:22px;overflow:hidden;"><tr><td style="padding:28px;">
<img src="${input.logoSrc}" alt="StudyDate ID" width="168" height="36" style="display:block;width:168px;height:auto;border:0;" />
<h1 style="margin:20px 0 0 0;font-family:Poppins,Inter,Segoe UI,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-0.03em;color:${BRAND_NAVY};">${heading}</h1>
<p style="margin:16px 0 0 0;font-size:16px;line-height:1.65;color:#4B5565;">${lead}</p>
<div style="margin-top:20px;color:#4B5565;font-size:15px;line-height:1.6;"><strong style="color:${BRAND_NAVY};">Yang perlu kamu perhatikan:</strong><ul style="padding-left:20px;margin:12px 0 0 0;">${reasonItems}</ul></div>
${noteHtml}${actionHtml}
<p style="margin:26px 0 0 0;padding-top:20px;border-top:1px solid #E2E8F0;font-size:12px;letter-spacing:0.08em;color:#6B7280;">MEET • CONNECT • GROW</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, text: textLines.join("\n"), html };
}
