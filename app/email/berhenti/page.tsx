import { unsubscribeEventEmailAction } from "@/app/email/berhenti/actions";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<{ token?: string; state?: string }>;
};

export const metadata = {
  title: "Berhenti menerima email acara | StudyDate ID",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

async function UnsubscribeState({ searchParams }: Props) {
  const { token, state } = await searchParams;

  if (state === "done") {
    return (
      <div role="status" className="rounded-[22px] border border-brand-border bg-white p-6">
        <h2 className="font-heading text-2xl font-semibold text-brand-navy">Sudah berhenti</h2>
        <p className="mt-3 leading-7 text-brand-muted">
          Kamu tidak akan menerima email pengumuman acara lagi. Kabar dari penyelenggara tetap muncul
          sebagai notifikasi di aplikasi. Kamu bisa menyalakannya kembali dari Pengaturan.
        </p>
        <Link
          href="/app/settings#notifikasi"
          className="focus-ring mt-5 inline-flex min-h-11 items-center rounded-xl border border-brand-border bg-white px-4 text-sm font-semibold text-brand-navy"
        >
          Buka Pengaturan
        </Link>
      </div>
    );
  }

  const validShape = typeof token === "string" && /^[a-f0-9]{64}$/i.test(token);
  if (!validShape || state === "invalid") {
    return (
      <div role="alert" className="rounded-[22px] border border-red-200 bg-white p-6">
        <h2 className="font-heading text-2xl font-semibold text-brand-navy">Tautan tidak valid</h2>
        <p className="mt-3 leading-7 text-brand-muted">
          Gunakan tautan dari email pengumuman terbaru, atau matikan email acara dari Pengaturan
          setelah masuk.
        </p>
      </div>
    );
  }

  return (
    <form action={unsubscribeEventEmailAction} className="rounded-[22px] border border-brand-border bg-white p-6">
      <input type="hidden" name="token" value={token} />
      <h2 className="font-heading text-2xl font-semibold text-brand-navy">Berhenti menerima email acara?</h2>
      <p className="mt-3 leading-7 text-brand-muted">
        Email pengumuman dari semua acara yang kamu ikuti akan berhenti. Notifikasi di dalam aplikasi
        tetap jalan.
      </p>
      <button
        type="submit"
        className="focus-ring mt-5 min-h-11 rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white"
      >
        Ya, berhenti
      </button>
    </form>
  );
}

export default function UnsubscribeEventEmailPage(props: Props) {
  return (
    <main className="notebook-paper min-h-svh py-10 sm:py-16">
      <div className="page-shell max-w-2xl">
        <Link href="/" className="inline-flex">
          <Image src="/brand/logo-horizontal-color.png" alt="StudyDate ID" width={190} height={48} priority />
        </Link>
        <p className="section-label mt-10">Email acara</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.03em] text-brand-navy">
          Atur email pengumuman
        </h1>
        <div className="mt-8">
          <Suspense
            fallback={
              <p role="status" className="text-sm font-semibold text-brand-muted">
                Memuat…
              </p>
            }
          >
            <UnsubscribeState {...props} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
