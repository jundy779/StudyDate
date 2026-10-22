import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import { formatTicketPrice } from "@/lib/events/ticketing";
import { listManagedTicketOrders } from "@/lib/events/ticketing-operations";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ publicSlug: string }> };
const labels: Record<string, string> = { pending: "Menunggu pembayaran", paid: "Sudah dibayar", free: "Gratis", expired: "Kedaluwarsa", cancelled: "Dibatalkan", refunded: "Dikembalikan", partially_refunded: "Dikembalikan sebagian", payment_review: "Pembayaran perlu diperiksa" };

export default async function TicketOrdersPage({ params }: PageProps) {
  const { publicSlug } = await params;
  if (process.env.EVENT_TICKETING_ENABLED !== "true") notFound();
  const [{ event, overview }, orders] = await Promise.all([getCampusEventManagement(publicSlug, "registrations"), listManagedTicketOrders(publicSlug)]);
  const totalPaid = orders.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.total_amount, 0);
  const sold = orders.filter((item) => item.status === "paid" || item.status === "free").reduce((sum, item) => sum + item.quantity, 0);
  return <AppShell current="events"><main className="min-h-svh overflow-x-clip bg-brand-surface"><EventManagementShell active="tickets" event={event} overview={overview}>
    <section><Link href={`/app/events/${publicSlug}/manage/tickets`} className="text-sm font-semibold text-brand-blue">← Kembali ke tiket</Link><p className="app-kicker mt-5">Pesanan</p><h2 className="mt-2 text-2xl font-bold text-brand-navy">Ringkasan penjualan tiket</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">Halaman ini tidak membuka nama asli atau kontak pembeli. Pembayaran yang perlu diperiksa ditandai khusus. Jangan menganggapnya tiket aktif sebelum statusnya selesai.</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-brand-line bg-white p-4"><dt className="text-sm text-brand-muted">Pesanan</dt><dd className="mt-1 text-2xl font-bold text-brand-navy">{orders.length}</dd></div><div className="rounded-2xl border border-brand-line bg-white p-4"><dt className="text-sm text-brand-muted">Tiket selesai</dt><dd className="mt-1 text-2xl font-bold text-brand-navy">{sold}</dd></div><div className="rounded-2xl border border-brand-line bg-white p-4"><dt className="text-sm text-brand-muted">Penjualan kotor</dt><dd className="mt-1 text-2xl font-bold text-brand-navy">{formatTicketPrice(totalPaid)}</dd></div></dl>
      <div className="mt-6 overflow-hidden rounded-2xl border border-brand-line bg-white"><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-brand-surface text-brand-muted"><tr><th className="px-4 py-3">Tiket</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Dibuat</th></tr></thead><tbody>{orders.map((item) => <tr key={item.order_public_id} className="border-t border-brand-line"><td className="px-4 py-3 font-semibold text-brand-navy">{item.ticket_name}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">{formatTicketPrice(item.total_amount, item.currency)}</td><td className="px-4 py-3">{labels[item.status] ?? item.status}</td><td className="whitespace-nowrap px-4 py-3">{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(item.created_at))}</td></tr>)}</tbody></table></div>{orders.length === 0 ? <p className="p-6 text-sm text-brand-muted">Belum ada pesanan tiket.</p> : null}</div>
    </section>
  </EventManagementShell></main></AppShell>;
}
