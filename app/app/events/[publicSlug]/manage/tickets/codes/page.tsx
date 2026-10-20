import { createTicketCodeAction } from "@/app/app/events/[publicSlug]/manage/tickets/actions";
import { AppShell } from "@/components/app/app-shell";
import { EventManagementShell } from "@/components/events/event-management-shell";
import { getCampusEventManagement } from "@/lib/events/management";
import { listTicketDiscountCodes } from "@/lib/events/ticketing-operations";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ publicSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function TicketCodesPage({ params, searchParams }: PageProps) {
  const { publicSlug } = await params;
  if (process.env.EVENT_TICKETING_ENABLED !== "true") notFound();
  const [{ event, overview }, codes, query] = await Promise.all([
    getCampusEventManagement(publicSlug, "registrations"), listTicketDiscountCodes(publicSlug), searchParams,
  ]);
  const action = createTicketCodeAction.bind(null, publicSlug);
  return <AppShell current="events"><main className="min-h-svh overflow-x-clip bg-brand-surface"><EventManagementShell active="tickets" event={event} overview={overview}>
    <section><Link href={`/app/events/${publicSlug}/manage/tickets`} className="text-sm font-semibold text-brand-blue">← Kembali ke tiket</Link><p className="section-label mt-5">Kode tiket</p><h2 className="mt-2 text-2xl font-bold text-brand-navy">Kode akses tiket</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">Kode akses aktif bisa dipakai untuk tiket gratis yang memerlukan kode. Setelah membuatnya, buka tiket dari halaman pengelolaan. Kode promo potongan harga masih dalam persiapan. Catat kodenya sebelum menyimpan, karena kode asli tidak ditampilkan lagi.</p>
      {first(query.error) ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{first(query.error)}</p> : null}{first(query.saved) ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">Kode berhasil disimpan.</p> : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{codes.map((code) => <article key={code.code_public_id} className="rounded-2xl border border-brand-line bg-white p-5"><div className="flex items-center justify-between gap-3"><strong className="font-mono text-brand-navy">{code.code_hint}</strong><span className="rounded-full bg-brand-surface px-3 py-1 text-xs font-bold text-brand-navy">{code.status === "active" ? "Aktif" : code.status}</span></div><p className="mt-3 text-sm text-brand-muted">{code.purpose === "unlock" ? "Kode akses" : code.discount_type === "percent" ? `Potongan ${code.discount_value}%` : `Potongan Rp${code.discount_value.toLocaleString("id-ID")}`}</p><p className="mt-1 text-xs text-brand-muted">Dipakai {code.redemption_count}{code.max_redemptions ? ` dari ${code.max_redemptions} kali` : " kali"}</p></article>)}</div>
      <form action={action} className="mt-8 rounded-3xl border border-brand-line bg-white p-5 sm:p-6"><h3 className="text-lg font-bold text-brand-navy">Buat kode akses tiket gratis</h3><p className="mt-1 text-sm text-brand-muted">Bagikan kode hanya kepada peserta yang kamu pilih. Satu pemakaian berlaku untuk satu tiket.</p><input type="hidden" name="purpose" value="unlock"/><input type="hidden" name="discountType" value=""/><input type="hidden" name="discountValue" value="0"/><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-brand-navy">Kode<input name="code" minLength={4} maxLength={40} required autoComplete="off" placeholder="Contoh: KAMPUS2026" className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3 uppercase"/></label><label className="text-sm font-semibold text-brand-navy">Batas pemakaian<input name="maxRedemptions" type="number" min={1} max={10000} placeholder="Kosong berarti tanpa batas" className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3"/></label><label className="text-sm font-semibold text-brand-navy">Mulai berlaku<input name="startsAt" type="datetime-local" className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3"/></label><label className="text-sm font-semibold text-brand-navy">Berakhir<input name="endsAt" type="datetime-local" className="mt-2 min-h-11 w-full rounded-xl border border-brand-line px-3"/></label></div><button className="mt-5 min-h-12 rounded-xl bg-brand-blue px-5 font-semibold text-white">Simpan kode akses</button></form>
    </section>
  </EventManagementShell></main></AppShell>;
}

