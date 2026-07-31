import "server-only";

export type CampusVerificationEmail = {
  recipient: string;
  code: string;
  expiresInMinutes: number;
};

export interface CampusVerificationEmailSender {
  send(message: CampusVerificationEmail): Promise<void>;
}

class WebhookCampusVerificationEmailSender
  implements CampusVerificationEmailSender
{
  async send(message: CampusVerificationEmail) {
    const endpoint = process.env.STUDENT_VERIFICATION_EMAIL_WEBHOOK_URL;
    const token = process.env.STUDENT_VERIFICATION_EMAIL_WEBHOOK_TOKEN;
    if (!endpoint || !token) {
      throw new Error("Campus verification email delivery is unavailable.");
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error("Campus verification email delivery is unavailable.");
    }
  }
}

export const campusVerificationEmailSender =
  new WebhookCampusVerificationEmailSender();
