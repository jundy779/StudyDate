import { AppShell } from "@/components/app/app-shell";
import { createTicketOrderAction } from "@/app/app/events/[publicSlug]/tickets/actions";
import { getCampusEvent } from "@/lib/events/service";
import { formatTicketPrice } from "@/lib/events/ticketing";
import { listCampusEventTicketTypes, listMyCampusEventTicketOrders } from "@/lib/events/ticketing-service";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ publicSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function EventTicketsPage({ params, searchParams }: PageProps) {
  const { publicSlug } = await params;
  if (process.env.EVENT_TICKETING_ENABLED !== "true") notFound();
  const event = await getCampusEvent(publicSlug);
  if (!event) notFound();
  const [tickets, orders, query] = await Promise.all([listCampusEventTicketTypes(publicSlug), listMyCampusEventTicketOrders(publicSlug), searchParams]);
  const error = first(query.error);
  const order = first(query.order);

  return <AppShell current="events"><main className="min-h-svh overflow-x-clip bg-brand-surface px-4 py-8 sm:px-6"><div className="mx-auto max-w-5xl">
    <Link href={`/app/events/${publicSlug}`} className="text-sm font-semibold text-brand-blue">← Kembali ke acara</Link>
    <div className="mt-5 rounded-3xl bg-brand-navy p-6 text-white sm:p-8"><p className="text-sm font-semibold text-blue-200">Tiket acara</p><h1 className="mt-2 text-3xl font-bold">{event.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">Pilih tiket yang cocok. Harga, sisa kuota, dan batas pembelian terlihat sebelum kamu memesan.</p></div>
    {error ? <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}
    {order === "free" ? <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Tiket gratis berhasil diamankan.</p> : null}
    {order === "pending" ? <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Pesanan dibuat. Pembayaran belum dibuka sampai penyedia pembayaran selesai diverifikasi.</p> : null}
    <section className="mt-6 grid gap-4 md:grid-cols-2">{tickets.length ? tickets.map((ticket) => {
      const action = createTicketOrderAction.bind(null, publicSlug);
      return <article key={ticket.ticket_public_id} className="rounded-3xl border border-brand-line bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-brand-navy">{ticket.name}</h2><p className="mt-1 text-sm leading-6 text-brand-muted">{ticket.description || "Tiket untuk mengikuti acara ini."}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-brand-blue">{formatTicketPrice(ticket.price_amount, ticket.currency)}</span></div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-2xl bg-brand-surface p-3"><span className="block text-brand-muted">Masih tersedia</span><strong className="text-brand-navy">{ticket.quantity_available}</strong></div><div className="rounded-2xl bg-brand-surface p-3"><span className="block text-brand-muted">Per pesanan</span><strong className="text-brand-navy">{ticket.min_per_order}–{ticket.max_per_order}</strong></div></div>
        <form action={action} className="mt-5 space-y-3"><input type="hidden" name="ticketPublicId" value={ticket.ticket_public_id}/><input type="hidden" name="idempotencyKey" value={crypto.randomUUID()}/><label className="block text-sm font-semibold text-brand-navy">Jumlah<input name="quantity" type="number" min={ticket.min_per_order} max={Math.min(ticket.max_per_order, ticket.quantity_available)} defaultValue={ticket.min_per_order} required className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3"/></label>{ticket.access_type !== "public" ? <label className="block text-sm font-semibold text-brand-navy">Kode akses<input name="code" autoComplete="off" required className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3 uppercase" placeholder="Masukkan kode"/></label> : <input type="hidden" name="code" value=""/>}<button disabled={ticket.quantity_available < ticket.min_per_order} className="min-h-12 w-full rounded-xl bg-brand-blue px-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{ticket.quantity_available < ticket.min_per_order ? "Tiket habis" : ticket.price_amount === 0 ? "Ambil tiket" : "Buat pesanan"}</button></form>
      </article>;
    }) : <div className="rounded-3xl border border-brand-line bg-white p-8 md:col-span-2"><h2 className="text-xl font-bold text-brand-navy">Tiket belum tersedia</h2><p className="mt-2 text-sm text-brand-muted">Penyelenggara belum membuka jenis tiket untuk acara ini.</p></div>}</section>
    {orders.length ? <section className="mt-8"><h2 className="text-xl font-bold text-brand-navy">Pesanan kamu</h2><div className="mt-3 space-y-3">{orders.map((item) => <div key={item.order_public_id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-line bg-white p-4"><div><strong className="text-brand-navy">{item.ticket_name}</strong><p className="text-sm text-brand-muted">{item.quantity} tiket · {formatTicketPrice(item.total_amount, item.currency)}</p></div><span className="rounded-full bg-brand-surface px-3 py-1 text-xs font-bold text-brand-navy">{item.status === "free" ? "Selesai" : item.status === "pending" ? "Menunggu pembayaran" : item.status}</span></div>)}</div></section> : null}
  </div></main></AppShell>;
}
