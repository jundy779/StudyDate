import "server-only";

const BRAND_BLUE = "#014FE7";
const BRAND_NAVY = "#0F1B33";

/** Inline CID used by StudyDate SMTP/Resend attachments. */
export const STUDYDATE_EMAIL_LOGO_CID = "studydate-logo";

export type MagicLinkEmailKind = "student" | "staff" | "early-access";

export function buildMagicLinkEmail(input: {
  kind: MagicLinkEmailKind;
  confirmUrl: string;
  /**
   * Logo URL for HTML (prefer `cid:studydate-logo` with an inline attachment,
   * or an absolute https URL to `/brand/logo-horizontal-color.png`).
   */
  logoSrc?: string;
}) {
  const heading =
    input.kind === "staff"
      ? "Masuk ke workspace StudyDate ID"
      : input.kind === "early-access"
        ? "Akses awalmu sudah disetujui"
        : "Masuk ke StudyDate ID";
  const lead =
    input.kind === "staff"
      ? "Gunakan tautan ini untuk masuk ke ruang Owner/Admin StudyDate ID. Tautan hanya berlaku sekali dan akan kedaluarsa."
      : input.kind === "early-access"
        ? "Kamu sudah mendapat akses awal ke StudyDate. Gunakan tautan sekali pakai ini untuk masuk dengan email yang kamu daftarkan, aktifkan aksesmu, lalu lengkapi pengaturan akun."
        : "Gunakan tautan ini untuk masuk ke StudyDate ID. Tautan hanya berlaku sekali dan akan kedaluarsa.";

  const subject =
    input.kind === "staff"
      ? "Tautan masuk staff StudyDate ID"
      : input.kind === "early-access"
        ? "Akses awal StudyDate kamu sudah disetujui"
        : "Tautan masuk StudyDate ID";

  const buttonLabel =
    input.kind === "early-access" ? "Mulai di StudyDate" : "Masuk sekarang";

  const logoSrc = input.logoSrc?.trim() || `cid:${STUDYDATE_EMAIL_LOGO_CID}`;

  const text = [
    "StudyDate ID",
    "",
    heading,
    "",
    lead,
    "",
    `Buka tautan: ${input.confirmUrl}`,
    "",
    "Jika kamu tidak meminta tautan ini, abaikan email ini.",
    "",
    "— StudyDate ID",
    "MEET • CONNECT • GROW",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND_NAVY};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F7FB;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:22px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px 28px;">
              <img src="${logoSrc}" alt="StudyDate ID" width="168" height="36" style="display:block;width:168px;height:auto;border:0;outline:none;text-decoration:none;" />
              <h1 style="margin:20px 0 0 0;font-family:Poppins,Inter,Segoe UI,sans-serif;font-size:28px;line-height:1.2;letter-spacing:-0.03em;color:${BRAND_NAVY};">${heading}</h1>
              <p style="margin:16px 0 0 0;font-size:16px;line-height:1.65;color:#4B5565;">${lead}</p>
              <p style="margin:28px 0 0 0;">
                <a href="${input.confirmUrl}" style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:12px;">${buttonLabel}</a>
              </p>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">Jika tombol tidak berfungsi, salin tautan ini ke browser:<br /><span style="word-break:break-all;color:${BRAND_NAVY};">${input.confirmUrl}</span></p>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6B7280;">Jika kamu tidak meminta tautan ini, abaikan email ini. Jangan bagikan tautan kepada siapa pun.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px 28px;">
              <p style="margin:0;padding-top:20px;border-top:1px solid #E2E8F0;font-size:12px;letter-spacing:0.08em;color:#6B7280;">MEET • CONNECT • GROW</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
