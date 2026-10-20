import { requireEventFeatureAccess } from "@/lib/account/student-access";
import { AppShell } from "@/components/app/app-shell";
import { createCodeTicketOrderAction, createPaidTicketOrderAction, createTicketOrderAction } from "@/app/app/events/[publicSlug]/tickets/actions";
import { getCampusEvent } from "@/lib/events/service";
import { formatTicketPrice } from "@/lib/events/ticketing";
import { listCampusEventTicketTypes, listMyCampusEventTicketOrders } from "@/lib/events/ticketing-service";
import { paidTicketsEnabled } from "@/lib/events/paid-ticket-checkout";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ publicSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function EventTicketsPage({ params, searchParams }: PageProps) {
  await requireEventFeatureAccess();
  const { publicSlug } = await params;
  if (process.env.EVENT_TICKETING_ENABLED !== "true") notFound();
  const event = await getCampusEvent(publicSlug);
  if (!event) notFound();
  const [tickets, orders, query] = await Promise.all([listCampusEventTicketTypes(publicSlug), listMyCampusEventTicketOrders(publicSlug), searchParams]);
  const availableTickets = tickets.filter((ticket) => ticket.status === "on_sale" && (ticket.access_type === "public" || (ticket.access_type === "code" && ticket.price_amount === 0)) && (ticket.price_amount === 0 || paidTicketsEnabled()));
  const error = first(query.error);
  const order = first(query.order);

  return <AppShell current="events"><main className="min-h-svh overflow-x-clip bg-brand-surface px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl">
    <Link href={`/app/events/${publicSlug}`} className="text-sm font-semibold text-brand-blue">← Kembali ke acara</Link>
    <div className="mt-5 rounded-3xl bg-brand-navy p-6 text-white sm:p-8"><p className="text-sm font-semibold text-blue-200">Tiket acara</p><h1 className="mt-2 text-3xl font-bold">{event.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Daftar ke acara dulu. Setelah dikonfirmasi, kamu bisa memilih satu tiket. Jika berbayar, tiket aktif setelah pembayaran terverifikasi.</p></div>
    {event.rsvp_status !== "going" ? <p className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-brand-navy">Pendaftaranmu belum terkonfirmasi. <Link href={`/app/events/${publicSlug}`} className="font-semibold text-brand-blue underline">Buka detail acara</Link> untuk mendaftar atau melihat statusmu.</p> : null}
    {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {order === "free" ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Tiket gratis berhasil diamankan. <Link href={`/app/events/${publicSlug}`} className="font-semibold underline">Buka acara untuk membuat QR masuk.</Link></p> : null}
    <section className="mt-6 grid gap-4 md:grid-cols-2">{availableTickets.length ? availableTickets.map((ticket) => {
      const action = (ticket.access_type === "code" ? createCodeTicketOrderAction : ticket.price_amount === 0 ? createTicketOrderAction : createPaidTicketOrderAction).bind(null, publicSlug);
      return <article key={ticket.ticket_public_id} className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-brand-navy">{ticket.name}</h2><p className="mt-1 text-sm leading-6 text-brand-muted">{ticket.description || "Tiket untuk mengikuti acara ini."}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-blue">{formatTicketPrice(ticket.price_amount, ticket.currency)}</span></div>
        <div className="mt-5 rounded-2xl bg-brand-surface p-3 text-sm"><span className="block text-brand-muted">Masih tersedia</span><strong className="text-brand-navy">{ticket.quantity_available}</strong></div>
        <form action={action} className="mt-5 space-y-3"><input type="hidden" name="ticketPublicId" value={ticket.ticket_public_id}/><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><input type="hidden" name="quantity" value="1"/>
          {ticket.access_type === "code" ? <label className="block text-sm font-semibold text-brand-navy">Kode akses<input name="code" required minLength={4} maxLength={40} autoComplete="off" placeholder="Masukkan kode dari penyelenggara" className="mt-2 min-h-12 w-full rounded-xl border border-brand-line px-3 font-normal"/></label> : null}
          <button disabled={event.rsvp_status !== "going" || ticket.quantity_available < 1 || orders.some((item) => item.status === "free" || item.status === "paid" || item.status === "pending")} className="min-h-12 w-full rounded-xl bg-brand-blue px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{ticket.quantity_available < 1 ? "Tiket habis" : orders.some((item) => item.status === "free" || item.status === "paid") ? "Tiket sudah kamu ambil" : ticket.price_amount > 0 ? "Lanjut bayar" : ticket.access_type === "code" ? "Ambil tiket dengan kode" : "Ambil satu tiket"}</button></form>
      </article>;
    }) : <div className="rounded-3xl border border-brand-line bg-white p-8 md:col-span-2"><h2 className="text-xl font-bold text-brand-navy">Tiket belum tersedia</h2><p className="mt-2 text-sm text-brand-muted">Penyelenggara belum membuka jenis tiket untuk acara ini.</p></div>}</section>
    {orders.length ? <section className="mt-8"><h2 className="text-xl font-bold text-brand-navy">Pesanan kamu</h2><div className="mt-3 space-y-3">{orders.map((item) => <div key={item.order_public_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white p-4"><div><strong className="text-brand-navy">{item.ticket_name}</strong><p className="text-sm text-brand-muted">{item.quantity} tiket · {formatTicketPrice(item.total_amount, item.currency)}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-brand-surface px-3 py-1 text-xs font-bold text-brand-navy">{item.status === "free" ? "Selesai" : item.status === "pending" ? "Menunggu pembayaran" : item.status}</span>{item.total_amount > 0 ? <Link href={`/app/events/${publicSlug}/tickets/payment/${item.order_public_id}`} className="text-sm font-semibold text-brand-blue underline">Lihat pembayaran</Link> : null}</div></div>)}</div></section> : null}
  </div></main></AppShell>;
}

