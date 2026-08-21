import { StaffShell } from "@/components/staff/staff-shell";
import { requireStaffCapability } from "@/lib/staff/authorization";
import { getStudentAccountOpsDetail } from "@/lib/staff/service";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
  volunteering: "Volunteering",
};

const goalLabels: Record<string, string> = {
  study: "Belajar",
  friendship: "Pertemanan",
  networking: "Networking",
  collaboration: "Kolaborasi",
  campus_activities: "Kegiatan kampus",
  meaningful_connection: "Koneksi bermakna",
};

async function UserDetailContent({ params }: Props) {
  const access = await requireStaffCapability("users.read");
  const parsed = accountRefSchema.safeParse((await params).accountRef);
  if (!parsed.success) notFound();

  const account = await getStudentAccountOpsDetail(parsed.data);
  if (!account) notFound();

  return (
    <StaffShell role={access.role} current="users" access={access}>
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <Link
            href="/staff/users"
            className="focus-ring inline-flex min-h-11 items-center text-sm font-semibold text-brand-blue"
          >
            ← Kembali ke akun mahasiswa
          </Link>
          <p className="section-label mt-5">Ringkasan dukungan · {account.account_ref}</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            {account.alias}
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-brand-muted">
            Data yang relevan untuk membantu akun. Pembukaan halaman ini dicatat.
            NIM, email lengkap, kontak, chat, foto identitas, dan bukti verifikasi
            tetap tertutup.
          </p>

          <section className="mt-8 border-y border-brand-border py-7" aria-labelledby="account-state">
            <h2 id="account-state" className="font-heading text-2xl font-semibold">
              Status akun
            </h2>
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div><dt className="text-sm text-brand-muted">Email tersamarkan</dt><dd className="mt-1 font-semibold">{account.email_display}</dd></div>
              <div><dt className="text-sm text-brand-muted">Status</dt><dd className="mt-1 font-semibold">{account.account_status}</dd></div>
              <div><dt className="text-sm text-brand-muted">Onboarding</dt><dd className="mt-1 font-semibold">{account.onboarding_status}</dd></div>
              <div><dt className="text-sm text-brand-muted">Tampil di People</dt><dd className="mt-1 font-semibold">{account.is_discoverable ? "Ya" : "Tidak"}</dd></div>
              <div><dt className="text-sm text-brand-muted">Verifikasi mahasiswa</dt><dd className="mt-1 font-semibold">{account.verification_summary}</dd></div>
              <div><dt className="text-sm text-brand-muted">Akun dibuat</dt><dd className="mt-1 font-semibold">{dateFmt.format(new Date(account.created_at))}</dd></div>
            </dl>
          </section>

          <section className="border-b border-brand-border py-7" aria-labelledby="membership-state">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="membership-state" className="font-heading text-2xl font-semibold">
                  Membership
                </h2>
                <p className="mt-2 text-brand-muted">
                  {account.membership_plan}
                  {account.membership_ends_at
                    ? ` · berlaku sampai ${dateFmt.format(new Date(account.membership_ends_at))}`
                    : ""}
                </p>
              </div>
              {access.role === "owner" ? (
                <Link
                  href="/owner/memberships"
                  className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-brand-border px-4 text-sm font-semibold text-brand-blue"
                >
                  Kelola paket dengan email
                </Link>
              ) : null}
            </div>
          </section>

          <section className="py-7" aria-labelledby="profile-summary">
            <h2 id="profile-summary" className="font-heading text-2xl font-semibold">
              Profil belajar
            </h2>
            <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div><dt className="text-sm text-brand-muted">Kampus</dt><dd className="mt-1 font-semibold">{account.campus}</dd></div>
              <div><dt className="text-sm text-brand-muted">Program studi</dt><dd className="mt-1 font-semibold">{account.study_program}</dd></div>
              <div><dt className="text-sm text-brand-muted">Jenjang</dt><dd className="mt-1 font-semibold">{account.degree_level}</dd></div>
              <div><dt className="text-sm text-brand-muted">Semester</dt><dd className="mt-1 font-semibold">{account.semester ?? "Belum diisi"}</dd></div>
              <div><dt className="text-sm text-brand-muted">Kota/Kabupaten</dt><dd className="mt-1 font-semibold">{account.city_region}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-brand-muted">Bio singkat</dt><dd className="mt-1 max-w-3xl leading-7">{account.short_intro}</dd></div>
              <div><dt className="text-sm text-brand-muted">Minat</dt><dd className="mt-1">{account.interests.length ? account.interests.map((item) => interestLabels[item] ?? item).join(", ") : "Belum diisi"}</dd></div>
              <div><dt className="text-sm text-brand-muted">Tujuan koneksi</dt><dd className="mt-1">{account.connection_goals.length ? account.connection_goals.map((item) => goalLabels[item] ?? item).join(", ") : "Belum diisi"}</dd></div>
            </dl>
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

export default function StaffUserDetailPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan ringkasan akun…</p>
        </main>
      }
    >
      <UserDetailContent {...props} />
    </Suspense>
  );
}
