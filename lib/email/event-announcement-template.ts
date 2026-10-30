// Templat email pengumuman acara. Murni (tanpa server-only) supaya bisa diuji langsung.

const BRAND_BLUE = "#014FE7";
const BRAND_NAVY = "#0F1B33";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Satu baris tanpa karakter kontrol, untuk subjek email. */
function singleLine(value: string, max: number) {
  const clean = value.replace(/[\u0000-\u001F\u007F]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export type EventAnnouncementEmailInput = {
  eventTitle: string;
  eventStartsAt: string;
  eventTimezone: string;
  announcementTitle: string;
  announcementBody: string;
  eventUrl: string;
  unsubscribeUrl: string;
  logoSrc: string;
};

export function formatEventEmailDate(startsAt: string, timezone: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: timezone || "Asia/Jakarta",
    }).format(new Date(startsAt));
  } catch {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(new Date(startsAt));
  }
}

export function buildEventAnnouncementEmail(input: EventAnnouncementEmailInput) {
  const eventTitle = singleLine(input.eventTitle, 120);
  const announcementTitle = singleLine(input.announcementTitle, 100);
  const subject = singleLine(`${announcementTitle} · ${eventTitle}`, 150);
  const when = formatEventEmailDate(input.eventStartsAt, input.eventTimezone);
  const body = input.announcementBody.trim();

  const text = [
    "StudyDate ID",
    "",
    `Kabar dari penyelenggara ${eventTitle}`,
    `Jadwal acara: ${when}`,
    "",
    announcementTitle,
    "",
    body,
    "",
    "Buka acara di StudyDate:",
    input.eventUrl,
    "",
    "Kamu menerima email ini karena terdaftar sebagai peserta acara tersebut.",
    "Berhenti menerima email pengumuman acara:",
    input.unsubscribeUrl,
    "",
    "Tim StudyDate ID",
  ].join("\n");

  const bodyHtml = escapeHtml(body).replace(/\r?\n/g, "<br />");
  const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F5F7FB;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND_NAVY};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F5F7FB;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:22px;overflow:hidden;"><tr><td style="padding:28px;">
<img src="${escapeHtml(input.logoSrc)}" alt="StudyDate ID" width="150" style="display:block;height:auto;border:0;" />
<p style="margin:26px 0 0 0;font-size:13px;font-weight:700;color:${BRAND_BLUE};">Kabar dari penyelenggara</p>
<p style="margin:4px 0 0 0;font-size:15px;line-height:1.5;color:#4B5565;">${escapeHtml(eventTitle)}<br /><span style="font-size:13px;">${escapeHtml(when)}</span></p>
<h1 style="margin:22px 0 0 0;font-size:22px;line-height:1.3;color:${BRAND_NAVY};">${escapeHtml(announcementTitle)}</h1>
<p style="margin:14px 0 0 0;font-size:15px;line-height:1.7;color:#334155;">${bodyHtml}</p>
<p style="margin:26px 0 0 0;"><a href="${escapeHtml(input.eventUrl)}" style="display:inline-block;background:${BRAND_BLUE};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:15px;padding:14px 22px;border-radius:12px;">Buka acara</a></p>
<p style="margin:28px 0 0 0;padding-top:18px;border-top:1px solid #E2E8F0;font-size:12px;line-height:1.6;color:#6B7280;">Kamu menerima email ini karena terdaftar sebagai peserta acara di StudyDate. Penyelenggara tidak melihat alamat emailmu. <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#6B7280;">Berhenti menerima email pengumuman acara</a>.</p>
</td></tr></table>
</td></tr></table>
</body>
</html>`;

  return { subject, text, html };
}
