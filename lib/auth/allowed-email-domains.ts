/**
 * Allowed student email domains for StudyDate public signup/login.
 * - Exact: gmail.com, vk.com
 * - Suffix: *.ac.id, *.sch.id (and exact ac.id / sch.id)
 * Staff login is not governed by this list.
 */

export const STUDENT_EMAIL_DOMAIN_HELP =
  "Gunakan email @gmail.com, @vk.com, atau yang berakhiran .ac.id / .sch.id. Email sekolah (.sch.id) hanya bisa mengikuti acara edukatif.";

export const STUDENT_EMAIL_DOMAIN_ERROR =
  "Email ini belum didukung. Gunakan @gmail.com, @vk.com, atau email berakhiran .ac.id / .sch.id.";

export function getEmailDomain(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) {
    return null;
  }
  return normalized.slice(at + 1);
}

/** Email sekolah (.sch.id): hanya boleh mengikuti acara edukatif. */
export function isSchoolEmail(email: string | null | undefined): boolean {
  const domain = email ? getEmailDomain(email) : null;
  if (!domain) {
    return false;
  }
  return domain === "sch.id" || domain.endsWith(".sch.id");
}

export function isAllowedStudentEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  if (domain === "gmail.com" || domain === "vk.com") {
    return true;
  }

  if (domain === "ac.id" || domain.endsWith(".ac.id")) {
    return true;
  }

  if (domain === "sch.id" || domain.endsWith(".sch.id")) {
    return true;
  }

  return false;
}
