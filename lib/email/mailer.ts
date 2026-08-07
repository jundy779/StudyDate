import "server-only";

import nodemailer from "nodemailer";

export type StudyDateOutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export function isStudyDateEmailConfigured() {
  if (process.env.STUDYDATE_RESEND_API_KEY && process.env.STUDYDATE_EMAIL_FROM) {
    return true;
  }
  return Boolean(
    process.env.STUDYDATE_SMTP_HOST &&
      process.env.STUDYDATE_SMTP_USER &&
      process.env.STUDYDATE_SMTP_PASSWORD &&
      process.env.STUDYDATE_EMAIL_FROM,
  );
}

function fromAddress() {
  const from = process.env.STUDYDATE_EMAIL_FROM?.trim();
  if (!from) {
    throw new Error("StudyDate email delivery is unavailable.");
  }
  return from;
}

async function sendViaResend(message: StudyDateOutboundEmail) {
  const apiKey = process.env.STUDYDATE_RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error("StudyDate email delivery is unavailable.");
  }
}

async function sendViaSmtp(message: StudyDateOutboundEmail) {
  const host = process.env.STUDYDATE_SMTP_HOST;
  const user = process.env.STUDYDATE_SMTP_USER;
  const pass = process.env.STUDYDATE_SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  const port = Number(process.env.STUDYDATE_SMTP_PORT ?? "587");
  const secure = process.env.STUDYDATE_SMTP_SECURE === "true" || port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: fromAddress(),
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

/**
 * Sends outbound product email from StudyDate ID.
 * Never uses Supabase Auth's built-in mailer.
 */
export async function sendStudyDateEmail(message: StudyDateOutboundEmail) {
  if (!isStudyDateEmailConfigured()) {
    throw new Error("StudyDate email delivery is unavailable.");
  }

  if (process.env.STUDYDATE_RESEND_API_KEY) {
    await sendViaResend(message);
    return;
  }

  await sendViaSmtp(message);
}
