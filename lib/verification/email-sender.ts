import "server-only";

import {
  isStudyDateEmailConfigured,
  sendStudyDateEmail,
} from "@/lib/email/mailer";

export type CampusVerificationEmail = {
  recipient: string;
  code: string;
  expiresInMinutes: number;
  authorizeDelivery: () => Promise<void>;
};

export interface CampusVerificationEmailSender {
  send(message: CampusVerificationEmail): Promise<void>;
}

class StudyDateCampusVerificationEmailSender
  implements CampusVerificationEmailSender {
  async send(message: CampusVerificationEmail) {
    if (!isStudyDateEmailConfigured()) {
      throw new Error("Campus verification email delivery is unavailable.");
    }

    await message.authorizeDelivery();
    await sendStudyDateEmail({
      to: message.recipient,
      subject: "Kode verifikasi mahasiswa StudyDate ID",
      text: `Kode verifikasi mahasiswa StudyDate ID: ${message.code}. Kode berlaku ${message.expiresInMinutes} menit. Abaikan email ini jika kamu tidak memintanya.`,
      html: `<p>Kode verifikasi mahasiswa StudyDate ID:</p><p style="font-size:24px;font-weight:700;letter-spacing:0.2em">${message.code}</p><p>Kode berlaku ${message.expiresInMinutes} menit. Abaikan email ini jika kamu tidak memintanya.</p>`,
    });
  }
}

export const campusVerificationEmailSender =
  new StudyDateCampusVerificationEmailSender();
