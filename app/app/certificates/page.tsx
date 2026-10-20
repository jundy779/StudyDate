import { revokeMyCertificateAction } from "@/app/app/events/after-actions";
import { AppShell } from "@/components/app/app-shell";
import { MascotHead } from "@/components/brand/mascot-head";
import { listMyCertificates } from "@/lib/events/after";
import { CERTIFICATE_BASIS_LABELS } from "@/lib/events/after-rules";
import { Award, Download, ExternalLink } from "lucide-react";
import Link from "next/link";

type CertificatesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CertificatesPage({ searchParams }: CertificatesPageProps) {
  const [certificates, query] = await Promise.all([listMyCertificates(), searchParams]);
  const state = Array.isArray(query.state) ? query.state[0] : query.state;

  return (
    <AppShell current="events">
      <main className="min-h-svh overflow-x-clip bg-brand-surface">
        <div className="page-shell max-w-4xl py-8 sm:py-12 lg:py-16">
          <p className="font-hand text-xl text-brand-blue">Bukti kamu pernah ikut</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
            Sertifikatku
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted sm:text-base">
            Sertifikat kehadiran dari acara yang kamu ikuti. Siapa pun yang punya kodenya bisa
            mengecek keaslian di studydate.id. Batalkan kalau kamu tidak ingin namamu tampil lagi.
          </p>

          {state === "revoked" ? (
            <p role="status" className="mt-6 border-l-2 border-brand-blue pl-4 text-sm font-medium text-brand-blue">
              Sertifikat dibatalkan. Halaman ceknya tidak lagi menampilkan namamu.
            </p>
          ) : state === "error" ? (
            <p role="alert" className="mt-6 border-l-2 border-brand-error pl-4 text-sm font-medium text-brand-error">
              Tindakan belum berhasil. Coba lagi sebentar.
            </p>
          ) : null}

          {certificates.length ? (
            <ul className="mt-8 grid gap-4">
              {certificates.map((item) => (
                <li
                  key={item.verify_code}
                  className="rounded-2xl border-2 border-brand-navy bg-white p-5 shadow-[4px_4px_0_#0F1B33] sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
                        <Award className="h-4 w-4" aria-hidden="true" />
                        {new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: item.event_timezone }).format(
                          new Date(item.event_starts_at),
                        )}
                      </p>
                      <h2 className="mt-1 break-words font-heading text-xl font-semibold text-brand-navy">
                        <Link href={`/app/events/${item.event_public_slug}`} className="hover:text-brand-blue">
                          {item.event_title}
                        </Link>
                      </h2>
                      <p className="mt-1 text-sm text-brand-muted">
                        Atas nama {item.recipient_name} · {CERTIFICATE_BASIS_LABELS[item.attendance_basis]}
                      </p>
                      <p className="mt-1 font-mono text-sm tracking-wider text-brand-navy">{item.verify_code}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Link
                        href={`/certificates/${item.verify_code}`}
                        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy bg-white px-4 text-sm font-semibold text-brand-navy"
                      >
                        Lihat
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <a
                        href={`/certificates/${item.verify_code}/image`}
                        download={`sertifikat-${item.verify_code}.png`}
                        className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-4 text-sm font-semibold text-white"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        PNG
                      </a>
                    </div>
                  </div>
                  <details className="mt-4">
                    <summary className="focus-ring inline-flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-brand-muted hover:text-brand-error">
                      Batalkan sertifikat
                    </summary>
                    <form action={revokeMyCertificateAction} className="mt-2 max-w-md rounded-xl border border-red-200 bg-red-50 p-4">
                      <input type="hidden" name="verifyCode" value={item.verify_code} />
                      <p className="text-sm leading-6 text-brand-navy">
                        Kode ini akan tampil sebagai tidak berlaku. Kamu bisa mengambil ulang dari halaman
                        acara dengan kode baru selama masih dalam masa pengambilan.
                      </p>
                      <button className="focus-ring mt-3 min-h-11 rounded-xl bg-brand-error px-4 text-sm font-semibold text-white">
                        Ya, batalkan
                      </button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-8 flex items-center gap-5 rounded-2xl border-2 border-dashed border-brand-navy/15 bg-white p-6">
              <span className="w-16 shrink-0" aria-hidden="true">
                <MascotHead expression="penasaran" />
              </span>
              <p className="text-sm leading-6 text-brand-muted">
                Belum ada sertifikat. Kalau penyelenggara menyediakannya, tombol ambil sertifikat muncul
                di halaman acara setelah acaranya selesai.{" "}
                <Link href="/app/events" className="font-semibold text-brand-blue">Cari acara</Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
