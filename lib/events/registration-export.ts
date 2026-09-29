import type {
  CampusEventQuestion,
  CampusEventRegistration,
} from "@/lib/events/service";
import type { EventRegistrationStatus } from "@/lib/events/constants";

const registrationStatusLabels: Record<EventRegistrationStatus, string> = {
  pending: "Menunggu persetujuan",
  going: "Diterima",
  waitlisted: "Daftar tunggu",
  declined: "Ditolak",
  cancelled: "Dibatalkan",
};

function protectSpreadsheetFormula(value: string) {
  return /^[\t ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: unknown) {
  const normalized = protectSpreadsheetFormula(
    String(value ?? "").replace(/\r?\n/g, " "),
  );
  return `"${normalized.replace(/"/g, '""')}"`;
}

function formatAnswer(value: string | string[] | boolean | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return value ?? "";
}

function formatRegisteredAt(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function buildEventRegistrationCsv(input: {
  timezone: string;
  questions: CampusEventQuestion[];
  registrations: CampusEventRegistration[];
}) {
  const headers = [
    "Alias peserta",
    "Kampus",
    "Program studi",
    "Semester",
    "Status pendaftaran",
    "Status kehadiran",
    "Waktu mendaftar",
    ...input.questions.map((question) => question.prompt),
  ];
  const rows = input.registrations.map((registration) => [
    registration.public_alias,
    registration.campus,
    registration.study_program,
    registration.semester ?? "",
    registrationStatusLabels[registration.registration_status],
    registration.checked_in_at ? "Sudah hadir" : "Belum hadir",
    formatRegisteredAt(registration.rsvped_at, input.timezone),
    ...input.questions.map((question) =>
      formatAnswer(
        registration.registration_answers[question.question_public_id],
      ),
    ),
  ]);

  return `\uFEFF${[headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}\r\n`;
}

