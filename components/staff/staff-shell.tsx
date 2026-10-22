import {
  StaffFrame,
  type StaffNavCounts,
  type StaffNavGroup,
  type StaffNavKey,
} from "@/components/staff/staff-frame";
import { countUnresolvedModerationReports } from "@/lib/moderation/service";
import type { StaffAccess, StaffRole } from "@/lib/staff/authorization";
import { getEarlyAccessQueueSummary, listVerificationQueue } from "@/lib/staff/service";
import type { ReactNode } from "react";

type StaffShellProps = {
  children: ReactNode;
  current: StaffNavKey;
  role: StaffRole;
  access?: Pick<
    StaffAccess,
    "canEarlyAccessRead" | "canEarlyAccessReview" | "canUsersRead" | "canUsersSupport" | "verificationReviewer"
  >;
};

/** Angka di menu hanya bantuan. Kalau gagal dimuat, menu tetap tampil tanpa angka. */
async function safeCount<T>(load: () => Promise<T>, pick: (value: T) => number | null) {
  try {
    return pick(await load());
  } catch {
    return null;
  }
}

const OPEN_VERIFICATION = new Set(["pending", "under_review", "needs_action"]);

/**
 * Menu langsung dirender; angka di menu menyusul lewat promise yang dibaca di client (Suspense),
 * supaya pindah halaman tidak menunggu tiga panggilan ke database.
 */
export function StaffShell({ children, current, role, access }: StaffShellProps) {
  const isOwner = role === "owner";
  const canEarlyAccess =
    isOwner || access?.canEarlyAccessRead === true || access?.canEarlyAccessReview === true;
  const canUsers = isOwner || access?.canUsersRead === true || access?.canUsersSupport === true;
  const canVerification = isOwner || access?.verificationReviewer === true;

  const counts: Promise<StaffNavCounts> = Promise.all([
    canEarlyAccess ? getEarlyAccessQueueSummary().catch(() => null) : Promise.resolve(null),
    isOwner ? safeCount(countUnresolvedModerationReports, (value) => value) : Promise.resolve(null),
    canVerification
      ? safeCount(
          () => listVerificationQueue(),
          (rows) => rows.filter((row) => OPEN_VERIFICATION.has(row.status)).length,
        )
      : Promise.resolve(null),
  ]).then(([earlyAccess, reports, verifications]) => ({
    "early-access": {
      count: earlyAccess?.waiting_count ?? null,
      urgent: (earlyAccess?.stale_waiting_count ?? 0) > 0,
    },
    moderation: { count: reports, urgent: true },
    verification: { count: verifications },
  }));

  const base = isOwner ? "/owner" : "/admin";
  const earlyAccessHref = isOwner ? "/owner/early-access" : "/staff/early-access";

  const groups: StaffNavGroup[] = [
    { label: "Mulai di sini", items: [{ key: "overview", href: base, label: "Ringkasan" }] },
  ];

  const people: StaffNavGroup = { label: "Pendaftar dan akun", items: [] };
  if (canEarlyAccess) people.items.push({ key: "early-access", href: earlyAccessHref, label: "Akses Awal" });
  if (canUsers) people.items.push({ key: "users", href: "/staff/users", label: "Akun mahasiswa" });
  if (canVerification) {
    people.items.push({ key: "verification", href: "/admin/verifications", label: "Verifikasi mahasiswa" });
  }
  if (people.items.length) groups.push(people);

  if (isOwner) {
    groups.push({
      label: "Keamanan",
      items: [{ key: "moderation", href: "/owner/moderation", label: "Laporan" }],
    });
  }

  groups.push({
    label: "Kegiatan",
    items: [{ key: "events", href: `${base}/events`, label: "Acara Kampus" }],
  });

  if (isOwner) {
    groups.push({
      label: "Paket",
      items: [{ key: "memberships", href: "/owner/memberships", label: "StudyDate Plus" }],
    });
  }

  const site: StaffNavGroup = {
    label: "Data dan situs",
    items: [
      { key: "campuses", href: `${base}/campuses`, label: "Daftar kampus" },
      { key: "study-programs", href: `${base}/study-programs`, label: "Daftar jurusan" },
    ],
  };
  if (isOwner) site.items.push({ key: "contact", href: "/owner/contact", label: "Kontak dan media sosial" });
  groups.push(site);

  if (isOwner) {
    groups.push({
      label: "Tim",
      items: [
        { key: "staff", href: "/owner/staff", label: "Tim dan hak akses" },
        { key: "audit", href: "/owner/audit", label: "Riwayat akses" },
      ],
    });
  }

  return (
    <StaffFrame role={isOwner ? "owner" : "admin"} current={current} groups={groups} counts={counts}>
      {children}
    </StaffFrame>
  );
}
