import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { EarlyAccessRevisionForm } from "@/components/early-access/revision-form";

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export const metadata = {
  title: "Perbarui Early Access | StudyDate ID",
  robots: { index: false, follow: false },
};

function RevisionStateFallback() {
  return (
    <div
      className="rounded-[22px] border border-brand-border bg-white p-6"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-brand-muted">
        Memuat formulir perbaikan…
      </p>
    </div>
  );
}

async function RevisionState({ searchParams }: Props) {
  const { token } = await searchParams;
  const validShape =
    typeof token === "string" && token.length >= 32 && token.length <= 200;

  return validShape ? (
    <EarlyAccessRevisionForm token={token} />
  ) : (
    <div className="rounded-[22px] border border-red-200 bg-white p-6">
      <h2 className="font-heading text-2xl font-semibold text-brand-navy">
        Tautan tidak valid
      </h2>
      <p className="mt-3 leading-7 text-brand-muted">
        Gunakan tautan perbaikan terbaru yang dikirim melalui email StudyDate.
      </p>
    </div>
  );
}

export default function EarlyAccessRevisePage({ searchParams }: Props) {
  return (
    <main className="min-h-svh bg-brand-surface py-10 sm:py-16">
      <div className="page-shell max-w-3xl">
        <Link href="/" className="inline-flex">
          <Image
            src="/brand/logo-horizontal-color.png"
            alt="StudyDate ID"
            width={190}
            height={48}
            priority
          />
        </Link>
        <p className="section-label mt-10">Early Access</p>
        <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-5xl">
          Perbarui pendaftaranmu
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-brand-muted">
          Isi ulang informasi yang diminta pada email review. Setelah dikirim,
          pendaftaran akan kembali ke antrean dan perlu disetujui lagi oleh tim StudyDate.
        </p>

        <div className="mt-8">
          <Suspense fallback={<RevisionStateFallback />}>
            <RevisionState searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
