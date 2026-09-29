import {
  grantPlusMembership,
  lookupMembership,
  revokePlusMembership,
  updateBillingOffer,
} from "@/app/owner/memberships/actions";
import { StaffShell } from "@/components/staff/staff-shell";
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
      <main className="min-h-svh bg-brand-surface">
        <div className="page-shell py-10 sm:py-14">
          <p className="section-label">Khusus Owner</p>
          <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
            Paket & pembayaran
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-brand-muted">
            Kelola tiga pilihan akses StudyDate Plus dan bantu akun mahasiswa
            bila pembayaran perlu ditangani. Plus dibeli berdasarkan durasi,
            bukan langganan yang memperpanjang otomatis.
          </p>

          {message ? (
            <p
              role="status"
              className={`mt-6 rounded-xl px-4 py-3 text-sm font-semibold ${
                isError ? "bg-red-50 text-brand-error" : "bg-green-50 text-brand-success"
              }`}
            >
              {message}
            </p>
          ) : null}

          <section className="mt-8 border-y border-brand-border py-7">
            <h2 className="font-heading text-2xl font-semibold text-brand-navy">
              Paket yang dijual
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
              Mahasiswa memilih 7, 30, atau 90 hari. Pembelian saat Plus masih
              aktif menambah durasi dari tanggal berakhir sebelumnya.
            </p>
            <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
              {PLUS_PACKAGES.map((preset) => {
                const offer =
                  offers.find((item) => item.packageCode === preset.code) ?? preset;
                return (
                  <form
                    key={preset.code}
                    action={updateBillingOffer}
                    className="grid gap-4 py-5 sm:grid-cols-[minmax(9rem,0.7fr)_1fr_auto_auto] sm:items-end"
                  >
                    <input type="hidden" name="packageCode" value={preset.code} />
                    <div>
                      <p className="font-semibold text-brand-navy">
                        Plus {preset.durationDays} Hari
                      </p>
                      <p className="mt-1 text-sm text-brand-muted">
                        Akses selama {preset.durationDays} hari
                      </p>
                    </div>
                    <label className="text-sm font-semibold">
                      Harga (rupiah)
                      <input
                        name="amountIdr"
                        type="number"
                        min={1}
                        max={10_000_000}
                        required
                        defaultValue={offer.amountIdr}
                        className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
                      <input
                        name="isActive"
                        type="checkbox"
                        value="true"
                        defaultChecked={"isActive" in offer && offer.isActive === true}
                        className="focus-ring h-5 w-5"
                      />
                      Tersedia
                    </label>
                    <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                      Simpan
                    </button>
                  </form>
                );
              })}
            </div>
            <p className="mt-4 text-sm leading-6 text-brand-muted">
              Harga rencana: {PLUS_PACKAGES.map((item) => `${item.durationDays} hari ${currency.format(item.amountIdr)}`).join(" · ")}.
              Pembayaran hanya tersedia saat layanan AutoGoPay sudah diaktifkan oleh sistem.
            </p>
          </section>

          <form
            action={lookupMembership}
            className="mt-8 grid gap-4 rounded-[22px] border border-brand-border bg-white p-6 sm:grid-cols-[1fr_auto] sm:items-end"
          >
            <label className="text-sm font-semibold">
              Email akun StudyDate
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                defaultValue={email}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                autoComplete="off"
              />
            </label>
            <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
              Cari akun
            </button>
          </form>

          {email && !record ? (
            <p className="mt-6 text-sm text-brand-muted">
              Tidak ada akun yang cocok untuk email itu.
            </p>
          ) : null}

          {record ? (
            <section className="mt-8 rounded-[22px] border border-brand-border bg-white p-6">
              <p className="font-semibold text-brand-navy">{record.public_alias}</p>
              <p className="mt-2 text-sm text-brand-muted">
                Paket: {record.plan_code === "plus" ? "StudyDate Plus" : "StudyDate Free"}
              </p>
              {record.ends_at ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Berlaku sampai {dateFmt.format(new Date(record.ends_at))}
                </p>
              ) : null}
              {record.starts_at ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Mulai {dateFmt.format(new Date(record.starts_at))}
                </p>
              ) : null}
              {record.status ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Status: {membershipStatusLabel[record.status] ?? "Belum diketahui"}
                </p>
              ) : null}
              {record.source ? (
                <p className="mt-1 text-sm text-brand-muted">
                  Sumber:{" "}
                  {record.source === "owner_grant"
                    ? "Diberikan Owner"
                    : record.source === "promo"
                      ? "Promo"
                      : record.source === "early_access_promo"
                        ? "Promo Akses Awal"
                        : record.source === "system"
                          ? "Sistem"
                          : record.source === "future_payment"
                            ? "Pembayaran GoPay QRIS"
                            : "Sumber lain"}
                </p>
              ) : null}

              <form
                action={grantPlusMembership}
                className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <input type="hidden" name="email" value={email} />
                <label className="text-sm font-semibold">
                  Tambah durasi Plus
                  <select
                    name="durationDays"
                    defaultValue="7"
                    className="focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border px-4 text-sm"
                  >
                    {MEMBERSHIP_GRANT_DAYS.map((days) => (
                      <option key={days} value={days}>
                        {days} hari
                      </option>
                    ))}
                  </select>
                </label>
                <button className="focus-ring min-h-11 rounded-xl bg-brand-navy px-5 text-sm font-semibold text-white">
                  Tambahkan akses Plus
                </button>
              </form>
              {record.plan_code === "plus" ? (
                <form action={revokePlusMembership} className="mt-4">
                  <input type="hidden" name="email" value={email} />
                  <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">
                    Nonaktifkan Plus
                  </button>
                </form>
              ) : null}
            </section>
          ) : null}
        </div>
      </main>
    </StaffShell>
  );
}

export default function OwnerMembershipsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan paket & pembayaran…</p>
        </main>
      }
    >
      <MembershipsContent {...props} />
    </Suspense>
  );
}
