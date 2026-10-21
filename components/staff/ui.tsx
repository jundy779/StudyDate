import type { LucideIcon } from "lucide-react";
import { HelpCircle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

/**
 * Potongan bersama Ruang Operasional (Admin dan Owner).
 * Identitas StudyDate (Poppins/Inter, biru #014FE7, navy, kertas buku tulis, maskot)
 * dengan pola dashboard dari Fusionify UI: panel stiker, kartu angka, chip status.
 * Bahasa: langsung dan awam. Tidak ada angka atau data contoh yang dikarang.
 */

/* Tombol. Tetap kelas biasa supaya bisa dipakai di <button>, <a>, dan Link. */
const buttonBase =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-transform disabled:cursor-not-allowed disabled:opacity-60";
export const staffButton = {
  primary: `${buttonBase} border-2 border-brand-navy bg-brand-blue text-white shadow-[3px_3px_0_#0F1B33] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0_#0F1B33]`,
  secondary: `${buttonBase} border-2 border-brand-navy bg-white text-brand-navy shadow-[3px_3px_0_#0F1B33] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[1px_1px_0_#0F1B33]`,
  quiet: `${buttonBase} border border-brand-border bg-white text-brand-navy hover:border-brand-navy`,
  danger: `${buttonBase} border-2 border-brand-navy bg-brand-error text-white shadow-[3px_3px_0_#0F1B33] hover:-translate-y-0.5`,
  dangerQuiet: `${buttonBase} border border-red-200 bg-white text-brand-error hover:border-brand-error`,
};

export const staffField =
  "focus-ring mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-white px-4 text-sm text-brand-navy placeholder:text-brand-muted/70";
export const staffLabel = "block text-sm font-semibold text-brand-navy";

/** Kepala halaman: celetukan tangan, judul, penjelasan satu kalimat, tombol aksi. */
export function StaffPage({
  kicker,
  title,
  description,
  actions,
  mascot,
  children,
}: {
  kicker: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  mascot?: MascotExpression;
  children: ReactNode;
}) {
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12">
        <header className="flex flex-col gap-5 border-b-2 border-dashed border-brand-navy/15 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            {mascot ? (
              <span className="hidden w-14 shrink-0 sm:block" aria-hidden="true">
                <MascotHead expression={mascot} />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="font-hand text-xl text-brand-blue">{kicker}</p>
              <h1 className="mt-1 break-words font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-3 max-w-3xl text-base leading-7 text-brand-muted">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-3">{actions}</div> : null}
        </header>
        <div className="mt-8 grid gap-6">{children}</div>
      </div>
    </main>
  );
}

/** Kartu kerja bergaya stiker. Pakai `quiet` untuk panel sekunder supaya halaman tidak ramai. */
export function Panel({
  title,
  description,
  actions,
  id,
  quiet = false,
  children,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  quiet?: boolean;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`min-w-0 scroll-mt-24 rounded-[22px] bg-white p-4 sm:p-6 ${
        quiet
          ? "border border-brand-border"
          : "border-2 border-brand-navy shadow-[4px_4px_0_#0F1B33]"
      }`}
    >
      {title || actions ? (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? (
              <h2 id={headingId} className="font-heading text-xl font-semibold text-brand-navy">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Angka ringkas. `alert` untuk yang perlu segera ditangani, `blue` untuk satu sorotan. */
export function StatCard({
  label,
  value,
  help,
  href,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  help?: string;
  href?: string;
  icon?: LucideIcon;
  tone?: "default" | "alert" | "blue" | "calm";
}) {
  const toneClass =
    tone === "alert"
      ? "border-brand-error bg-red-50 shadow-[3px_3px_0_#B42318]"
      : tone === "blue"
        ? "border-brand-navy bg-brand-blue text-white shadow-[3px_3px_0_#0F1B33]"
        : tone === "calm"
          ? "border-brand-border bg-white"
          : "border-brand-navy bg-white shadow-[3px_3px_0_#0F1B33]";
  const valueClass =
    tone === "alert" ? "text-brand-error" : tone === "blue" ? "text-white" : "text-brand-navy";
  const mutedClass = tone === "blue" ? "text-white/90" : "text-brand-muted";
  const body = (
    <>
      <span className={`flex items-center gap-2 text-sm font-semibold ${mutedClass}`}>
        {Icon ? (
          <Icon className={`h-4 w-4 ${tone === "blue" ? "text-white" : "text-brand-blue"}`} aria-hidden="true" />
        ) : null}
        {label}
      </span>
      <span className={`mt-2 block font-heading text-3xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </span>
      {help ? <span className={`mt-1 block text-xs leading-5 ${mutedClass}`}>{help}</span> : null}
    </>
  );
  const className = `block h-full rounded-2xl border-2 p-4 sm:p-5 ${toneClass}`;
  return href ? (
    <Link
      href={href}
      className={`focus-ring ${className} transition-transform hover:-translate-y-0.5 motion-reduce:transition-none`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

const chipTone = {
  go: "bg-[#E3F6E9] text-[#157F3B]",
  wait: "bg-[#FFF2D8] text-[#8A5300]",
  warn: "bg-[#FFE9D6] text-[#8A4A00]",
  stop: "bg-red-50 text-brand-error",
  info: "bg-[#EAF1FF] text-brand-blue",
  muted: "bg-brand-surface text-brand-muted",
} as const;

/** Status ditulis dengan kata, warna hanya pendukung. */
export function StatusChip({
  tone,
  children,
}: {
  tone: keyof typeof chipTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${chipTone[tone]}`}
    >
      {children}
    </span>
  );
}

/** Kotak pesan. `role` diatur sesuai nada supaya pembaca layar ikut memberi tahu. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warn" | "danger";
  title?: string;
  children: ReactNode;
}) {
  const toneClass = {
    info: "border-brand-blue/30 bg-[#EAF1FF] text-brand-navy",
    success: "border-green-200 bg-green-50 text-[#14532D]",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-brand-error",
  }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${toneClass}`}
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

/** Keadaan kosong yang tetap ramah: maskot, satu kalimat, dan langkah berikutnya bila ada. */
export function EmptyState({
  expression = "penasaran",
  title,
  children,
  action,
}: {
  expression?: MascotExpression;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border-2 border-dashed border-brand-navy/15 bg-white p-5 sm:flex-row sm:items-center">
      <span className="w-14 shrink-0" aria-hidden="true">
        <MascotHead expression={expression} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-brand-navy">{title}</p>
        {children ? <div className="mt-1 text-sm leading-6 text-brand-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Penjelasan singkat yang bisa dibuka, untuk istilah yang mungkin asing. */
export function HelpTip({ label = "Apa ini?", children }: { label?: string; children: ReactNode }) {
  return (
    <details className="group text-sm">
      <summary className="focus-ring inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg font-semibold text-brand-blue">
        <HelpCircle className="h-4 w-4" aria-hidden="true" />
        {label}
      </summary>
      <div className="mt-2 max-w-2xl rounded-xl bg-brand-surface px-4 py-3 leading-6 text-brand-navy">
        {children}
      </div>
    </details>
  );
}

/** Daftar tugas di ringkasan: satu baris per hal yang perlu ditangani. */
export function TodoItem({
  href,
  icon: Icon,
  title,
  description,
  count,
  urgent = false,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  count?: number | null;
  urgent?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="focus-ring group flex items-center gap-4 rounded-2xl border border-brand-border bg-white p-4 transition-colors hover:border-brand-navy"
      >
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
            urgent ? "bg-red-50 text-brand-error" : "bg-[#EAF1FF] text-brand-blue"
          }`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-brand-navy group-hover:text-brand-blue">{title}</span>
          <span className="block text-sm leading-5 text-brand-muted">{description}</span>
        </span>
        {typeof count === "number" ? (
          <span
            className={`shrink-0 rounded-full px-3 py-1 font-heading text-lg font-semibold tabular-nums ${
              count > 0
                ? urgent
                  ? "bg-brand-error text-white"
                  : "bg-brand-blue text-white"
                : "bg-brand-surface text-brand-muted"
            }`}
          >
            {count}
            <span className="sr-only"> menunggu</span>
          </span>
        ) : null}
      </Link>
    </li>
  );
}

/** Pembungkus tabel yang bisa digeser di HP tanpa melebarkan halaman. */
export function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="focus-ring relative -mx-1 overflow-x-auto rounded-xl px-1"
    >
      {children}
    </div>
  );
}

/** Saringan berbentuk kapsul. Yang aktif ditandai `aria-current`. */
export function FilterChips({
  label,
  items,
}: {
  label: string;
  items: { href: string; label: string; active: boolean; count?: number | null }[];
}) {
  return (
    <nav aria-label={label} className="mb-5 flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
            item.active
              ? "border-2 border-brand-navy bg-brand-navy text-white"
              : "border border-brand-border bg-white text-brand-navy hover:border-brand-navy"
          }`}
        >
          {item.label}
          {typeof item.count === "number" && item.count > 0 ? (
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                item.active ? "bg-white text-brand-navy" : "bg-[#EAF1FF] text-brand-blue"
              }`}
            >
              {item.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
