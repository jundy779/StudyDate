import { AppShell } from "@/components/app/app-shell";
import { AppPage, Notice, Panel, StatusChip, appButton } from "@/components/app/ui";
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
      label: "Pencarian teman per hari",
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
      label: "Acara mendatang yang kamu kelola",
      free: String(MEMBERSHIP_LIMITS.free.createdEventsActive),
      plus: String(MEMBERSHIP_LIMITS.plus.createdEventsActive),
    },
    {
      label: "Acara mendatang yang kamu ikuti",
      free: String(MEMBERSHIP_LIMITS.free.joinedEventsActive),
      plus: String(MEMBERSHIP_LIMITS.plus.joinedEventsActive),
    },
    {
      label: "Pilihan pencarian lanjutan",
      free: "Kampus dan program studi",
      plus: "Termasuk semester, kota, tujuan, dan minat",
    },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-border bg-white">
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
      <AppPage
        kicker="StudyDate Plus"
        title="Lebih banyak ruang untuk belajar dan berkenalan"
        description="StudyDate Free tetap utuh. StudyDate Plus menambah kapasitas, bukan memotong privasi, persetujuan, atau perlindungan keamanan."
        mascot="girang"
      >
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-brand-muted">Paket kamu</span>
              <StatusChip tone={isPlus ? "go" : "muted"}>{MEMBERSHIP_DISPLAY_NAME[membership.plan]}</StatusChip>
            </div>
            <h2 className="mt-2 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy">
              {MEMBERSHIP_DISPLAY_NAME[membership.plan]}
            </h2>
            {isPlus ? (
              <p className="mt-2 leading-7 text-brand-muted">
                Aktif
                {endsLabel ? ` sampai ${endsLabel}` : " tanpa batas waktu pada grant ini"}.
              </p>
            ) : membership.plusExpired ? (
              <p className="mt-2 leading-7 text-brand-muted">
                Paket Plus kamu telah berakhir. Saat ini akun kembali memakai
                StudyDate Free. Data yang sudah ada tetap aman.
              </p>
            ) : (
              <p className="mt-2 leading-7 text-brand-muted">
                Kamu memakai kapasitas Free. Circle, perkenalan, dan percakapan
                yang sudah ada tetap aman jika paket berubah.
              </p>
            )}
            {query.state === "payment_unavailable" ? (
              <div className="mt-4">
                <Notice tone="danger">Pembayaran sedang tidak tersedia. Coba lagi nanti.</Notice>
              </div>
            ) : null}
            {order ? (
              <div className="mt-5 rounded-2xl border border-brand-border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-brand-navy">
                    Pembayaran Plus {order.durationDays} Hari · {currency.format(order.amountIdr)}
                  </p>
                  <StatusChip tone={order.status === "paid" ? "go" : order.status === "pending" ? "wait" : "muted"}>
                    {order.status === "paid" ? "Berhasil" : order.status === "pending" ? "Menunggu pembayaran" : order.status}
                  </StatusChip>
                </div>
                {order.status === "pending" ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {order.checkoutUrl ? (
                      <a href={order.checkoutUrl} rel="noopener noreferrer" className={appButton.primary}>
                        Buka QRIS
                      </a>
                    ) : null}
                    <form action={refreshMembershipPayment}>
                      <input type="hidden" name="order" value={order.publicId} />
                      <button className={appButton.secondary}>Periksa status</button>
                    </form>
                    <form action={cancelMembershipPayment}>
                      <input type="hidden" name="order" value={order.publicId} />
                      <button className={appButton.quiet}>Batalkan QRIS</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Panel>

          <Panel
            id="plus-options"
            title="Pilih durasi Plus"
            description="Pembayaran diproses melalui GoPay QRIS. Plus dibeli berdasarkan durasi dan tidak diperpanjang otomatis, dan tidak ada tingkatan Basic, Pro, atau Premium."
            quiet
          >
            {offers.length > 0 && order?.status !== "pending" ? (
              <ul className="grid gap-3 md:grid-cols-3">
                {offers.map((offer) => (
                  <li key={offer.packageCode} className="rounded-2xl border border-brand-border p-4">
                    <form action={startMembershipCheckout} className="flex h-full flex-col gap-3">
                      <input type="hidden" name="packageCode" value={offer.packageCode} />
                      <div>
                        <h3 className="font-heading text-lg font-semibold text-brand-navy">
                          Plus {offer.durationDays} Hari
                        </h3>
                        <p className="mt-1 font-heading text-2xl font-semibold text-brand-blue">
                          {currency.format(offer.amountIdr)}
                        </p>
                        <p className="text-sm text-brand-muted">untuk {offer.durationDays} hari</p>
                      </div>
                      <button className={`${appButton.primary} mt-auto`}>
                        {isPlus ? "Tambah durasi" : "Pilih paket"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : order?.status === "pending" ? (
              <Notice tone="warn">
                Selesaikan atau batalkan pembayaran yang sedang menunggu sebelum memilih paket lain.
              </Notice>
            ) : (
              <Notice tone="info">Pembelian StudyDate Plus sedang tidak tersedia.</Notice>
            )}
            <p className="mt-4 text-sm leading-6 text-brand-muted">
              Paket aktif setelah pembayaran terverifikasi. Kalau kamu membeli lagi saat Plus masih aktif,
              durasi baru ditambahkan setelah masa aktif saat ini.
            </p>
          </Panel>

          <Panel title="Bedanya Free dan Plus" quiet>
            <ComparisonTable />
            <p className="mt-4 max-w-2xl text-sm leading-6 text-brand-muted">
              Blokir, laporkan, pusat keamanan, privasi, berbagi nama dan foto,
              berbagi kontak, serta penghapusan akun tetap tersedia untuk semua
              paket.{" "}
              <Link
                href="/app/settings"
                className="focus-ring font-semibold text-brand-blue underline-offset-2 hover:underline"
              >
                Buka pengaturan
              </Link>
              .
            </p>
          </Panel>
      </AppPage>
    </AppShell>
  );
}

export default function MembershipPage(props: MembershipPageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Menyiapkan paket...</p>
        </main>
      }
    >
      <MembershipContent {...props} />
    </Suspense>
  );
}
