import { StaffShell } from "@/components/staff/staff-shell";
import { Panel, StaffPage, StatusChip, staffButton } from "@/components/staff/ui";
import { requireStaffCapability } from "@/lib/staff/authorization";
import { getStudentAccountOpsDetail } from "@/lib/staff/service";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { z } from "zod";

type Props = { params: Promise<{ accountRef: string }> };
const accountRefSchema = z.string().regex(/^akun-[a-f0-9]{16}$/);
const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const interestLabels: Record<string, string> = {
  technology: "Teknologi",
  design: "Desain",
  business: "Bisnis",
  languages: "Bahasa",
  books: "Buku",
  film: "Film",
  music: "Musik",
  sports: "Olahraga",
  organizations: "Organisasi",
  career: "Karier",
  research: "Riset",
  volunteering: "Kegiatan sosial",
};

const goalLabels: Record<string, string> = {
  study: "Belajar",
  friendship: "Pertemanan",
  networking: "Memperluas relasi",
  collaboration: "Kolaborasi",
  campus_activities: "Kegiatan kampus",
  meaningful_connection: "Koneksi bermakna",
};

function onboardingLabel(value: string) {
  return value.replace("Onboarding", "Penyiapan akun");
}

function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`rounded-xl bg-brand-surface px-4 py-3 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-sm text-brand-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-brand-navy">{children}</dd>
    </div>
  );
}

async function UserDetailContent({ params }: Props) {
  const access = await requireStaffCapability("users.read");
  const parsed = accountRefSchema.safeParse((await params).accountRef);
  if (!parsed.success) notFound();

  const account = await getStudentAccountOpsDetail(parsed.data);
  if (!account) notFound();

  return (
    <StaffShell role={access.role} current="users" access={access}>
      <StaffPage
        kicker={`Ringkasan dukungan · ${account.account_ref}`}
        title={account.alias}
        description="Data yang relevan untuk membantu akun. Pembukaan halaman ini dicatat. NIM, email lengkap, kontak, percakapan, foto identitas, dan bukti verifikasi tetap tertutup."
        actions={
          <Link href="/staff/users" className={staffButton.quiet}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Kembali ke akun mahasiswa
          </Link>
        }
      >
        <Panel title="Status akun">
          <div className="mb-4 flex flex-wrap gap-1.5">
            <StatusChip tone="info">{account.account_status}</StatusChip>
            <StatusChip tone={account.verification_summary === "Terverifikasi" ? "go" : "wait"}>
              {account.verification_summary}
            </StatusChip>
            <StatusChip tone={account.is_discoverable ? "go" : "muted"}>
              {account.is_discoverable ? "Tampil di pencarian teman" : "Tidak tampil di pencarian teman"}
            </StatusChip>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label="Email tersamarkan">{account.email_display}</Item>
            <Item label="Penyiapan akun">{onboardingLabel(account.onboarding_status)}</Item>
            <Item label="Verifikasi mahasiswa">{account.verification_summary}</Item>
            <Item label="Akun dibuat">{dateFmt.format(new Date(account.created_at))}</Item>
          </dl>
        </Panel>

        <Panel
          title="Paket akun"
          quiet
          actions={
            access.role === "owner" ? (
              <Link href="/owner/memberships" className={staffButton.quiet}>
                Kelola paket dengan email
              </Link>
            ) : null
          }
        >
          <p className="text-brand-navy">
            <span className="font-semibold">{account.membership_plan}</span>
            {account.membership_ends_at
              ? ` · berlaku sampai ${dateFmt.format(new Date(account.membership_ends_at))}`
              : ""}
          </p>
        </Panel>

        <Panel title="Profil belajar" quiet>
          <dl className="grid gap-3 sm:grid-cols-2">
            <Item label="Kampus">{account.campus}</Item>
            <Item label="Program studi">{account.study_program}</Item>
            <Item label="Jenjang">{account.degree_level}</Item>
            <Item label="Semester">{account.semester ?? "Belum diisi"}</Item>
            <Item label="Kota/Kabupaten">{account.city_region}</Item>
            <Item label="Minat">
              {account.interests.length
                ? account.interests.map((item) => interestLabels[item] ?? item).join(", ")
                : "Belum diisi"}
            </Item>
            <Item label="Tujuan koneksi">
              {account.connection_goals.length
                ? account.connection_goals.map((item) => goalLabels[item] ?? item).join(", ")
                : "Belum diisi"}
            </Item>
            <Item label="Bio singkat" wide>
              <span className="font-normal leading-7">{account.short_intro}</span>
            </Item>
          </dl>
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function StaffUserDetailPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan ringkasan akun...</p>
        </main>
      }
    >
      <UserDetailContent {...props} />
    </Suspense>
  );
}
