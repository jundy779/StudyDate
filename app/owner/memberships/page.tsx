import {
  grantPlusMembership,
  lookupMembership,
  revokePlusMembership,
  updateBillingOffer,
} from "@/app/owner/memberships/actions";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  EmptyState,
  Notice,
  Panel,
  StaffPage,
  StatusChip,
  staffButton,
  staffField,
  staffLabel,
} from "@/components/staff/ui";
import { getOwnerBillingOffers } from "@/lib/billing/service";
import {
  MEMBERSHIP_GRANT_DAYS,
  PLUS_PACKAGES,
} from "@/lib/membership/limits";
import { lookupMembershipByEmail } from "@/lib/membership/service";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ email?: string; state?: string; package?: string }>;
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "UTC",
});
const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const membershipStatusLabel: Record<string, string> = {
  active: "Aktif",
  pending: "Menunggu pembayaran",
  expired: "Sudah berakhir",
  revoked: "Dicabut",
  inactive: "Tidak aktif",
};

const stateMessage: Record<string, string> = {
  saved: "Perubahan paket tersimpan.",
  error: "Perubahan paket belum dapat disimpan.",
  invalid: "Data paket belum sesuai. Periksa email, harga, atau durasi yang dipilih.",
  not_found: "Tidak ada akun StudyDate dengan email itu.",
  unchanged: "Tidak ada paket Plus aktif untuk dicabut.",
  offer_saved: "Penawaran StudyDate Plus tersimpan.",
};

async function MembershipsContent({ searchParams }: Props) {
  const access = await requireOwner();
  const query = await searchParams;
  const email = query.email?.trim().toLowerCase() || "";
  const message = query.state ? stateMessage[query.state] : null;
  const [record, offers] = await Promise.all([
    email ? lookupMembershipByEmail(email) : null,
    getOwnerBillingOffers(),
  ]);
  const isError =
    query.state === "error" ||
    query.state === "invalid" ||
    query.state === "not_found";

  return (
    <StaffShell role={access.role} current="memberships" access={access}>
      <StaffPage
        kicker="Khusus Owner"
        title="StudyDate Plus"
        description="Atur harga tiga pilihan Plus dan bantu akun mahasiswa kalau pembayarannya perlu ditangani. Plus dibeli berdasarkan durasi, bukan langganan yang memperpanjang otomatis."
        mascot="girang"
      >
        {message ? <Notice tone={isError ? "danger" : "success"}>{message}</Notice> : null}

        <Panel
          title="Paket yang dijual"
          description="Mahasiswa memilih 7, 30, atau 90 hari. Kalau membeli saat Plus masih aktif, durasinya ditambahkan dari tanggal berakhir sebelumnya."
        >
          <ul className="grid gap-3 lg:grid-cols-3">
            {PLUS_PACKAGES.map((preset) => {
              const offer = offers.find((item) => item.packageCode === preset.code) ?? preset;
              const active = "isActive" in offer && offer.isActive === true;
              return (
                <li key={preset.code} className="rounded-2xl border border-brand-border p-4">
                  <form action={updateBillingOffer} className="grid gap-3">
                    <input type="hidden" name="packageCode" value={preset.code} />
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-heading text-lg font-semibold text-brand-navy">Plus {preset.durationDays} Hari</p>
                      <StatusChip tone={active ? "go" : "muted"}>{active ? "Dijual" : "Tidak dijual"}</StatusChip>
                    </div>
                    <label className={staffLabel}>
                      Harga (rupiah)
                      <input
                        name="amountIdr"
                        type="number"
                        min={1}
                        max={10_000_000}
                        required
                        defaultValue={offer.amountIdr}
                        className={staffField}
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-brand-navy">
                      <input
                        name="isActive"
                        type="checkbox"
                        value="true"
                        defaultChecked={active}
                        className="focus-ring h-5 w-5 accent-brand-blue"
                      />
                      Tersedia untuk dibeli
                    </label>
                    <button className={staffButton.secondary}>Simpan</button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-sm leading-6 text-brand-muted">
            Harga rencana: {PLUS_PACKAGES.map((item) => `${item.durationDays} hari ${currency.format(item.amountIdr)}`).join(" · ")}.
            Pembayaran hanya tersedia saat layanan AutoGoPay sudah diaktifkan oleh sistem.
          </p>
        </Panel>

        <Panel title="Bantu akun mahasiswa" description="Cari dengan email untuk melihat, menambah, atau mencabut Plus." quiet>
          <form action={lookupMembership} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className={staffLabel}>
              Email akun StudyDate
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={email}
                className={staffField}
                autoComplete="off"
              />
            </label>
            <button className={staffButton.primary}>Cari akun</button>
          </form>

          {email && !record ? (
            <div className="mt-5">
              <EmptyState title="Akun tidak ditemukan" expression="kaget">
                Tidak ada akun yang cocok untuk email itu.
              </EmptyState>
            </div>
          ) : null}

          {record ? (
            <div className="mt-6 rounded-2xl border border-brand-border p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading text-lg font-semibold text-brand-navy">{record.public_alias}</p>
                <StatusChip tone={record.plan_code === "plus" ? "go" : "muted"}>
                  {record.plan_code === "plus" ? "StudyDate Plus" : "StudyDate Free"}
                </StatusChip>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Status", record.status ? membershipStatusLabel[record.status] ?? "Belum diketahui" : null],
                  ["Mulai", record.starts_at ? dateFmt.format(new Date(record.starts_at)) : null],
                  ["Berlaku sampai", record.ends_at ? dateFmt.format(new Date(record.ends_at)) : null],
                  [
                    "Sumber",
                    record.source
                      ? record.source === "owner_grant"
                        ? "Diberikan Owner"
                        : record.source === "promo"
                          ? "Promo"
                          : record.source === "early_access_promo"
                            ? "Promo Akses Awal"
                            : record.source === "system"
                              ? "Sistem"
                              : record.source === "future_payment"
                                ? "Pembayaran GoPay QRIS"
                                : "Sumber lain"
                      : null,
                  ],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-brand-surface px-4 py-3">
                      <dt className="text-brand-muted">{label}</dt>
                      <dd className="mt-1 font-semibold text-brand-navy">{value}</dd>
                    </div>
                  ))}
              </dl>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
                <form action={grantPlusMembership} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <input type="hidden" name="email" value={email} />
                  <label className={`${staffLabel} sm:w-56`}>
                    Tambah durasi Plus
                    <select name="durationDays" defaultValue="7" className={staffField}>
                      {MEMBERSHIP_GRANT_DAYS.map((days) => (
                        <option key={days} value={days}>
                          {days} hari
                        </option>
                      ))}
                    </select>
                  </label>
                  <button className={staffButton.primary}>Tambahkan akses Plus</button>
                </form>
                {record.plan_code === "plus" ? (
                  <form action={revokePlusMembership}>
                    <input type="hidden" name="email" value={email} />
                    <ConfirmSubmitButton
                      triggerLabel="Nonaktifkan Plus"
                      title="Nonaktifkan Plus untuk akun ini?"
                      description="Akun kembali ke StudyDate Free sekarang juga. Tindakan ini tercatat."
                      confirmLabel="Ya, nonaktifkan"
                      className={staffButton.dangerQuiet}
                    />
                  </form>
                ) : null}
              </div>
            </div>
          ) : null}
        </Panel>
      </StaffPage>
    </StaffShell>
  );
}

export default function OwnerMembershipsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan StudyDate Plus...</p>
        </main>
      }
    >
      <MembershipsContent {...props} />
    </Suspense>
  );
}
