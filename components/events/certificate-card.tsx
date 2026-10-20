import { MascotHead } from "@/components/brand/mascot-head";
import { CERTIFICATE_BASIS_LABELS } from "@/lib/events/after-rules";
import type { VerifiedCertificate } from "@/lib/events/after";
import { BadgeCheck } from "lucide-react";
import Image from "next/image";

type ValidCertificate = Extract<VerifiedCertificate, { status: "valid" }>;

function eventDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: timezone }).format(new Date(value));
}

/** Tampilan sertifikat di web. Versi PNG dibuat terpisah di route image. */
export function CertificateCard({ certificate, code }: { certificate: ValidCertificate; code: string }) {
  return (
    <article
      aria-label={`Sertifikat kehadiran untuk ${certificate.recipientName}`}
      className="notebook-paper relative overflow-hidden rounded-[22px] border-2 border-brand-navy bg-white p-6 shadow-[6px_6px_0_#0F1B33] sm:p-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Image
          src="/brand/logo-horizontal-color.png"
          alt="StudyDate ID"
          width={168}
          height={38}
          priority
          className="h-auto w-36 sm:w-44"
        />
        <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-brand-navy bg-[#E8FFF1] px-3 py-1 text-xs font-semibold text-[#0B6B3A]">
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          Terverifikasi StudyDate
        </span>
      </div>

      <p className="mt-8 font-hand text-2xl text-brand-blue sm:mt-12">Sertifikat kehadiran</p>
      <p className="mt-4 text-sm text-brand-muted">Diberikan kepada</p>
      <h1 className="mt-1 break-words font-heading text-3xl font-semibold leading-tight tracking-[-0.03em] text-brand-navy sm:text-5xl">
        <span className="bg-[linear-gradient(transparent_62%,#FFDC72_62%)] [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">{certificate.recipientName}</span>
      </h1>
      <p className="mt-6 text-sm text-brand-muted">atas keikutsertaan dalam</p>
      <p className="mt-1 max-w-3xl break-words font-heading text-xl font-semibold text-brand-navy sm:text-2xl">
        {certificate.eventTitle}
      </p>
      <p className="mt-2 text-sm text-brand-navy">
        {eventDate(certificate.eventStartsAt, certificate.eventTimezone)} · diselenggarakan oleh{" "}
        {certificate.organizerAlias}
        {certificate.isOfficial ? " · Acara resmi StudyDate" : ""}
      </p>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t-2 border-dashed border-brand-navy/20 pt-5">
        <dl className="grid gap-1 text-xs text-brand-muted">
          <div>
            <dt className="inline">Dasar: </dt>
            <dd className="inline font-semibold text-brand-navy">
              {CERTIFICATE_BASIS_LABELS[certificate.attendanceBasis]}
            </dd>
          </div>
          <div>
            <dt className="inline">Kode cek: </dt>
            <dd className="inline font-mono font-semibold tracking-wider text-brand-navy">{code}</dd>
          </div>
          <div>
            <dt className="inline">Cek di: </dt>
            <dd className="inline break-all">studydate.id/certificates/{code}</dd>
          </div>
        </dl>
        <span className="w-16 shrink-0 sm:w-20" aria-hidden="true">
          <MascotHead expression="girang" />
        </span>
      </div>
    </article>
  );
}
