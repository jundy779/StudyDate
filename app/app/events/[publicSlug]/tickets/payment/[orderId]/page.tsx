import { AppShell } from "@/components/app/app-shell";
import { getCampusEvent } from "@/lib/events/service";
import { formatTicketPrice } from "@/lib/events/ticketing";
import { listMyCampusEventTicketOrders } from "@/lib/events/ticketing-service";
import { getMyPaidEventTicket } from "@/lib/events/paid-ticket-checkout";
import { cancelPaidTicketAction } from "@/app/app/events/[publicSlug]/tickets/payment/[orderId]/actions";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ publicSlug: string; orderId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function TicketPaymentPage({ params, searchParams }: PageProps) {
  if (process.env.EVENT_TICKETING_ENABLED !== "true") notFound();
  const { publicSlug, orderId } = await params;
  if (!/^eto_[0-9a-f]{24}$/.test(orderId)) notFound();
  const [event, orders, payment] = await Promise.all([
    getCampusEvent(publicSlug), listMyCampusEventTicketOrders(publicSlug), getMyPaidEventTicket(orderId),
  ]);
  if (!event || !payment || !orders.some((item) => item.order_public_id === orderId)) notFound();
  const query = await searchParams;
  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  const needsReview = payment.payment_status === "paid" && payment.status !== "paid";
  const waiting = payment.status === "pending";
  const checkoutReady = waiting && payment.checkout_url && payment.expires_at
    && new Date(payment.expires_at).getTime() > Date.now();

  return <AppShell current="events"><main className="min-h-svh bg-brand-surface px-4 py-8 sm:px-6"><div className="mx-auto max-w-2xl">
    <Link href={`/app/events/${publicSlug}/tickets`} className="text-sm font-semibold text-brand-blue">← Kembali ke tiket</Link>
    <section className="mt-5 rounded-3xl border border-brand-line bg-white p-6 sm:p-8">
      <p className="section-label">Pembayaran tiket</p>
      <h1 className="mt-2 text-2xl font-bold text-brand-navy">{event.title}</h1>
      <p className="mt-4 text-lg font-semibold text-brand-navy">{formatTicketPrice(payment.total_amount)}</p>
      {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {payment.status === "paid" ? <div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">Pembayaran terkonfirmasi. <Link href={`/app/events/${publicSlug}`} className="font-semibold underline">Buka acara untuk membuat QR masuk.</Link></div>
      : needsReview ? <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Pembayaran tercatat, tetapi tiket perlu diperiksa. Jangan bayar ulang. Hubungi bantuan dengan nomor pesanan di bawah.</p>
      : checkoutReady ? <div className="mt-5 space-y-4"><p className="text-sm leading-6 text-brand-muted">Selesaikan pembayaran melalui halaman GoPay QRIS. Tiket aktif setelah pembayaran dikonfirmasi. Kembali ke halaman ini untuk melihat status terbaru.</p><a href={payment.checkout_url!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center rounded-xl bg-brand-blue px-5 font-semibold text-white">Buka halaman pembayaran</a><p className="text-xs text-brand-muted">Batas waktu: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(payment.expires_at!))} WIB</p></div>
      : waiting ? <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">Pesanan tersimpan, tetapi halaman pembayaran belum tersedia. Jangan buat pesanan lain dulu. Hubungi bantuan dengan nomor pesanan di bawah.</p>
      : <p className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-brand-navy">Pesanan ini sudah tidak aktif. Jika kamu sempat membayar, hubungi bantuan dan sertakan nomor pesanan.</p>}
      {checkoutReady ? <form action={cancelPaidTicketAction.bind(null, publicSlug, orderId)} className="mt-5"><button className="min-h-11 rounded-xl border border-brand-line px-4 text-sm font-semibold text-brand-navy">Batalkan pembayaran ini</button></form> : null}
      <p className="mt-6 break-all text-xs text-brand-muted">Nomor pesanan: {payment.order_public_id}</p>
    </section>
  </div></main></AppShell>;
}
