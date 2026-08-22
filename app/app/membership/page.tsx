import { AppShell } from "@/components/app/app-shell";
import {
  cancelMembershipPayment,
  refreshMembershipPayment,
  startMembershipCheckout,
} from "@/app/app/membership/actions";
import {
  getMyBillingOffers,
  getMyPaymentOrder,
} from "@/lib/billing/service";
import { paymentOrderPublicIdSchema } from "@/lib/billing/validation";
import {
  MEMBERSHIP_DISPLAY_NAME,
  MEMBERSHIP_LIMITS,
} from "@/lib/membership/limits";
import { getMyMembership } from "@/lib/membership/resolver";
import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function ComparisonTable() {
  const rows: { label: string; free: string; plus: string }[] = [
    {
      label: "People Discovery per hari",
      free: String(MEMBERSHIP_LIMITS.free.peopleDiscoveryDaily),
      plus: String(MEMBERSHIP_LIMITS.plus.peopleDiscoveryDaily),
    },
    {
      label: "Perkenalan baru per hari",
      free: String(MEMBERSHIP_LIMITS.free.introductionRequestsDaily),
      plus: String(MEMBERSHIP_LIMITS.plus.introductionRequestsDaily),
    },
    {
      label: "Perkenalan menunggu jawaban",
      free: String(MEMBERSHIP_LIMITS.free.activeIntroductions),
      plus: String(MEMBERSHIP_LIMITS.plus.activeIntroductions),
    },
    {
      label: "Circle yang kamu kelola",
      free: String(MEMBERSHIP_LIMITS.free.createdCirclesActive),
      plus: String(MEMBERSHIP_LIMITS.plus.createdCirclesActive),
    },
    {
      label: "Circle yang kamu ikuti",
      free: String(MEMBERSHIP_LIMITS.free.joinedCirclesActive),
      plus: String(MEMBERSHIP_LIMITS.plus.joinedCirclesActive),
    },
    {
      label: "Event mendatang yang kamu kelola",
      free: String(MEMBERSHIP_LIMITS.free.createdEventsActive),
      plus: String(MEMBERSHIP_LIMITS.plus.createdEventsActive),
    },
    {
      label: "Event mendatang yang kamu ikuti",
      free: String(MEMBERSHIP_LIMITS.free.joinedEventsActive),
      plus: String(MEMBERSHIP_LIMITS.plus.joinedEventsActive),
    },
    {
      label: "Filter People lanjutan",
      free: "Kampus dan program studi",
      plus: "Termasuk semester, kota, tujuan, dan minat",
    },
  ];

  return (
    <div className="mt-8 overflow-x-auto rounded-[22px] border border-brand-border bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Perbandingan StudyDate Free dan Plus</caption>
        <thead>
          <tr className="border-b border-brand-border">
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Kapasitas
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Free
            </th>
            <th scope="col" className="px-5 py-4 font-semibold text-brand-navy">
              Plus
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-brand-border last:border-b-0">
              <th scope="row" className="px-5 py-4 font-medium text-brand-navy">
                {row.label}
              </th>
              <td className="px-5 py-4 text-brand-muted">{row.free}</td>
              <td className="px-5 py-4 text-brand-muted">{row.plus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type MembershipPageProps = {
  searchParams: Promise<{ order?: string; state?: string }>;
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

async function MembershipContent({ searchParams }: MembershipPageProps) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");

  const query = await searchParams;
  const orderId = paymentOrderPublicIdSchema.safeParse(query.order);
  const [membership, offers, order] = await Promise.all([
    getMyMembership(),
    getMyBillingOffers(),
    getMyPaymentOrder(orderId.success ? orderId.data : undefined),
  ]);
  const isPlus = membership.plan === "plus";
  const endsLabel =
    isPlus && membership.endsAt
      ? dateFmt.format(new Date(membership.endsAt))
      : null;

  return (
    <AppShell current="membership">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell py-8 sm:py-12 lg:py-16">
          <p className="section-label">Akun</p>
          <h1 className="mt-4 max-w-3xl font-heading text-4xl font-semibold tracking-[-0.035em] text-brand-navy sm:text-5xl">
            Lebih banyak ruang untuk belajar, berkenalan, dan membangun koneksi.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-brand-muted">
            StudyDate Free tetap utuh. StudyDate Plus menambah kapasitas, bukan
            memotong privasi, persetujuan, atau perlindungan keamanan.
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
            Plus dibeli berdasarkan durasi dan tidak diperpanjang otomatis.
            Jika kamu membeli lagi saat Plus masih aktif, durasi baru ditambahkan
            setelah masa aktif saat ini.
          </p>

          <section className="mt-10 rounded-[22px] border border-brand-border bg-white p-6 sm:p-8">
            <p className="text-sm font-semibold text-brand-muted">Paket kamu</p>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy">
              {MEMBERSHIP_DISPLAY_NAME[membership.plan]}
            </h2>
            {isPlus ? (
              <p className="mt-3 leading-7 text-brand-muted">
                Aktif
                {endsLabel ? ` sampai ${endsLabel}` : " tanpa batas waktu pada grant ini"}.
              </p>
            ) : membership.plusExpired ? (
              <p className="mt-3 leading-7 text-brand-muted">
                Paket Plus kamu telah berakhir. Saat ini akun kembali memakai
                StudyDate Free. Data yang sudah ada tetap aman.
              </p>
            ) : (
              <p className="mt-3 leading-7 text-brand-muted">
                Kamu memakai kapasitas Free. Circle, perkenalan, dan percakapan
                yang sudah ada tetap aman jika paket berubah.
              </p>
            )}
            {query.state === "payment_unavailable" ? (
              <p role="alert" className="mt-5 text-sm font-semibold text-brand-error">
                Pembayaran sedang tidak tersedia. Coba lagi nanti.
              </p>
            ) : null}
            {order ? (
              <div className="mt-6 border-t border-brand-border pt-5">
                <p className="font-semibold text-brand-navy">
                  Pembayaran Plus {order.durationDays} Hari · {currency.format(order.amountIdr)}
                </p>
                <p className="mt-1 text-sm text-brand-muted">
                  Status: {order.status === "paid" ? "Berhasil" : order.status === "pending" ? "Menunggu pembayaran" : order.status}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {order.status === "pending" ? (
                    <>
                      {order.checkoutUrl ? (
                        <a
                          href={order.checkoutUrl}
                          rel="noopener noreferrer"
                          className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
                        >
                          Buka QRIS
                        </a>
                      ) : null}
                      <form action={refreshMembershipPayment}>
                        <input type="hidden" name="order" value={order.publicId} />
                        <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">
                          Periksa status
                        </button>
                      </form>
                      <form action={cancelMembershipPayment}>
                        <input type="hidden" name="order" value={order.publicId} />
                        <button className="focus-ring min-h-11 rounded-xl border border-brand-border px-5 text-sm font-semibold">
                          Batalkan QRIS
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>

          <section className="mt-10 border-y border-brand-border py-8" aria-labelledby="plus-options">
            <h2 id="plus-options" className="font-heading text-2xl font-semibold text-brand-navy">
              Pilih durasi Plus
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
              Pembayaran diproses melalui GoPay QRIS. Tidak ada auto-renew dan
              tidak ada tingkatan Basic, Pro, atau Premium.
            </p>
            {offers.length > 0 && order?.status !== "pending" ? (
              <div className="mt-5 divide-y divide-brand-border border-y border-brand-border">
                {offers.map((offer) => (
                  <form
                    key={offer.packageCode}
                    action={startMembershipCheckout}
                    className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <input type="hidden" name="packageCode" value={offer.packageCode} />
                    <div>
                      <h3 className="font-semibold text-brand-navy">
                        Plus {offer.durationDays} Hari
                      </h3>
                      <p className="mt-1 text-sm text-brand-muted">
                        {currency.format(offer.amountIdr)} untuk {offer.durationDays} hari
                      </p>
                    </div>
                    <button className="focus-ring min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white">
                      {isPlus ? "Tambah durasi" : "Pilih paket"}
                    </button>
                  </form>
                ))}
              </div>
            ) : order?.status === "pending" ? (
              <p className="mt-5 text-sm font-semibold text-brand-muted">
                Selesaikan atau batalkan pembayaran yang sedang menunggu sebelum memilih paket lain.
              </p>
            ) : (
              <p className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-brand-border px-5 text-sm font-semibold text-brand-muted">
                Pembelian StudyDate Plus sedang tidak tersedia
              </p>
            )}
            <p className="mt-4 text-sm leading-6 text-brand-muted">
              Paket aktif setelah pembayaran terverifikasi. Masa aktif baru
              dihitung dari hari ini atau dari tanggal berakhir Plus saat ini,
              mana yang lebih akhir.
            </p>
          </section>

          <ComparisonTable />

          <p className="mt-8 max-w-2xl text-sm leading-6 text-brand-muted">
            Blokir, laporkan, pusat keamanan, privasi, persetujuan, Identity
            Reveal, Contact Reveal, dan penghapusan akun tetap tersedia untuk
            semua paket.{" "}
            <Link
              href="/app/settings"
              className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Buka pengaturan
            </Link>
            .
          </p>
        </div>
      </main>
    </AppShell>
  );
}

export default function MembershipPage(props: MembershipPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan paket…</p>
        </main>
      }
    >
      <MembershipContent {...props} />
    </Suspense>
  );
}
