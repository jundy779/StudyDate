import { CertificateCard } from "@/components/events/certificate-card";
import { MascotHead } from "@/components/brand/mascot-head";
import { verifyCertificate } from "@/lib/events/after";
import { CERTIFICATE_CODE_PATTERN, normalizeCertificateCode } from "@/lib/events/after-rules";
import { Download, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

type CertificatePageProps = { params: Promise<{ code: string }> };

// Halaman memuat nama orang: jangan diindeks mesin pencari.
export const metadata: Metadata = {
  title: "Cek sertifikat | StudyDate ID",
  description: "Cek keaslian sertifikat kehadiran acara di StudyDate ID.",
  robots: { index: false, follow: false },
};

async function CertificateContent({ params }: CertificatePageProps) {
  const { code: raw } = await params;
  const code = normalizeCertificateCode(decodeURIComponent(raw));
  if (!CERTIFICATE_CODE_PATTERN.test(code)) notFound();
  const certificate = await verifyCertificate(code);
  if (!certificate) notFound();

  if (certificate.status === "revoked") {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
        <span className="w-24" aria-hidden="true">
          <MascotHead expression="kaget" />
        </span>
        <h1 className="mt-6 font-heading text-3xl font-semibold text-brand-navy">Sertifikat tidak berlaku</h1>
        <p className="mt-3 leading-7 text-brand-muted">
          Kode <span className="font-mono font-semibold text-brand-navy">{code}</span> pernah terbit,
          tetapi sudah dicabut atau dibatalkan pemiliknya. Data di dalamnya tidak ditampilkan lagi.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B6B3A]">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          Sertifikat ini asli dan masih berlaku.
        </p>
        <a
          href={`/certificates/${code}/image`}
          download={`sertifikat-${code}.png`}
          className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-brand-navy bg-brand-blue px-4 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33]"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Unduh PNG
        </a>
      </div>
      <CertificateCard certificate={certificate} code={code} />
      <p className="mt-6 max-w-2xl text-sm leading-6 text-brand-muted">
        Sertifikat menunjukkan keikutsertaan di acara StudyDate, bukan nilai akademik atau jaminan
        identitas. Nama ditulis sendiri oleh pemiliknya. <Link href="/events" className="font-semibold text-brand-blue underline-offset-4 hover:underline">Lihat acara lain</Link>
      </p>
    </>
  );
}

export default function CertificatePage(props: CertificatePageProps) {
  return (
    <section className="page-shell py-10 sm:py-14">
      <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[22px] bg-brand-surface" aria-busy="true" />}>
        <CertificateContent {...props} />
      </Suspense>
    </section>
  );
}
