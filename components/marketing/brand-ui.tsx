import type { ReactNode } from "react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

/**
 * Potongan visual bersama untuk halaman publik StudyDate.
 * Motif: kertas buku tulis, celetukan tulisan tangan, tombol bergaya stiker.
 */

export const stickerButton =
  "focus-ring inline-flex min-h-13 items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-brand-navy px-6 py-4 font-semibold shadow-[4px_4px_0_#0F1B33] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#0F1B33]";

export const stickerButtonPrimary = `${stickerButton} bg-brand-blue text-white`;
export const stickerButtonSecondary = `${stickerButton} bg-white text-brand-navy`;

/** Kartu bergaris navy dengan bayangan padat, dipakai hemat untuk satu fokus. */
export const stickerCard =
  "rounded-[20px] border-2 border-brand-navy bg-white shadow-[5px_5px_0_#0F1B33]";

export function WaveEdge({ fill, flip = false }: { fill: string; flip?: boolean }) {
  return (
    <svg
      className="wave-edge"
      viewBox="0 0 1440 64"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={flip ? { transform: "scaleY(-1)" } : undefined}
    >
      <path
        d="M0 32 C120 8 240 8 360 32 S600 56 720 32 960 8 1080 32 1320 56 1440 32 V64 H0 Z"
        fill={fill}
      />
    </svg>
  );
}

/** Celetukan kecil bertulisan tangan, pengganti label huruf kapital. */
export function HandNote({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: "blue" | "light";
  className?: string;
}) {
  return (
    <p
      className={`font-hand text-xl sm:text-2xl ${
        tone === "light" ? "text-[#8DB9F6]" : "text-brand-blue"
      } ${className ?? ""}`}
    >
      {children}
    </p>
  );
}

/** Pembuka halaman publik di atas kertas buku tulis, dengan maskot opsional. */
export function PageHero({
  note,
  title,
  children,
  mascot,
  aside,
}: {
  note?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  mascot?: MascotExpression;
  aside?: ReactNode;
}) {
  const side = aside ?? (mascot ? (
    <div className="mx-auto w-28 sm:w-44 lg:w-56">
      <MascotHead expression={mascot} />
    </div>
  ) : null);

  return (
    <section className="notebook-paper relative overflow-x-clip border-b border-brand-border">
      <span className="notebook-margin hidden sm:block" aria-hidden="true" />
      <div
        className={`page-shell relative grid gap-10 py-14 sm:py-20 ${
          side ? "lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" : ""
        }`}
      >
        <div className="min-w-0 max-w-3xl sm:pl-10 lg:pl-14">
          {note ? <HandNote>{note}</HandNote> : null}
          <h1 className="mt-3 text-balance font-heading text-[2.1rem] font-semibold leading-[1.15] tracking-[-0.035em] text-brand-navy sm:text-5xl">
            {title}
          </h1>
          {children ? (
            <div className="mt-6 max-w-2xl text-lg leading-8 text-brand-muted">{children}</div>
          ) : null}
        </div>
        {side}
      </div>
    </section>
  );
}
