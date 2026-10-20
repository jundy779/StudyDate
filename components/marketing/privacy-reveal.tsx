"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock3, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

const steps: {
  title: string;
  copy: string;
  expression: MascotExpression;
}[] = [
  {
    title: "Lihat profil tanpa nama asli",
    copy: "Kenali minat, kampus, dan alasan mereka ingin berteman.",
    expression: "penasaran",
  },
  {
    title: "Kirim perkenalan",
    copy: "Tulis alasan singkat kenapa kamu ingin kenalan.",
    expression: "mikir",
  },
  {
    title: "Tunggu persetujuan",
    copy: "Kalian baru bisa ngobrol setelah perkenalanmu diterima.",
    expression: "ngantuk",
  },
  {
    title: "Ngobrol tanpa buru-buru",
    copy: "Nama asli, foto, dan kontak tetap disembunyikan.",
    expression: "senang",
  },
  {
    title: "Sama-sama ingin lanjut",
    copy: "Kalian berdua memilih apakah ingin saling mengenal lebih jauh.",
    expression: "malu",
  },
  {
    title: "Bagikan seperlunya",
    copy: "Identitas dan kontak dibuka bertahap dengan persetujuan bersama.",
    expression: "girang",
  },
];

function Field({
  label,
  value,
  open,
}: {
  label: string;
  value: string;
  open: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-brand-border py-2.5 text-sm">
      <span className="text-brand-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className="reveal-field truncate font-semibold text-brand-navy"
          data-open={open}
          aria-hidden={!open}
        >
          {value}
        </span>
        {open ? (
          <LockKeyholeOpen className="h-4 w-4 shrink-0 text-brand-blue" aria-label="Terbuka" />
        ) : (
          <LockKeyhole className="h-4 w-4 shrink-0 text-brand-muted" aria-label="Masih tertutup" />
        )}
      </span>
    </div>
  );
}

function PreviewCard({ stage }: { stage: number }) {
  const identityOpen = stage >= 5;
  return (
    <div
      className="w-full rounded-[22px] border-2 border-brand-navy bg-white p-4 shadow-[6px_6px_0_#0F1B33] sm:p-5"
      aria-label="Contoh profil yang terbuka bertahap"
    >
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#EAF1FF] sm:h-20 sm:w-20">
          <MascotHead
            expression={steps[stage].expression}
            className="absolute inset-1.5 w-[calc(100%-12px)]"
          />
        </div>
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold text-brand-navy sm:text-xl">
            {identityOpen ? "Raka" : "Partner #482913"}
          </p>
          <p className="text-sm text-brand-muted">Desain Komunikasi Visual · semester 5</p>
        </div>
      </div>

      <div className="mt-4 min-h-[88px] rounded-2xl bg-brand-surface p-3 text-sm leading-6">
        {stage === 0 ? (
          <p className="text-brand-muted">
            Lagi cari teman diskusi untuk workshop UI hari Sabtu.
          </p>
        ) : null}
        {stage === 1 ? (
          <p className="ml-auto max-w-[90%] rounded-xl bg-brand-blue px-3 py-2 text-white">
            Hai, aku juga mau ikut workshop UI Sabtu. Boleh kenalan dulu?
          </p>
        ) : null}
        {stage === 2 ? (
          <p className="flex items-center gap-2 text-brand-muted">
            <Clock3 className="h-4 w-4 text-brand-blue" aria-hidden="true" />
            Perkenalan terkirim. Menunggu jawaban.
          </p>
        ) : null}
        {stage === 3 ? (
          <div className="space-y-2">
            <p className="max-w-[90%] rounded-xl border border-brand-border bg-white px-3 py-2 text-brand-navy">
              Boleh. Ngobrol di sini dulu ya.
            </p>
            <p className="ml-auto max-w-[80%] rounded-xl bg-brand-blue px-3 py-2 text-white">
              Siap, santai aja.
            </p>
          </div>
        ) : null}
        {stage === 4 ? (
          <p className="flex items-center gap-2 font-semibold text-brand-navy">
            <Check className="h-4 w-4 text-brand-blue" aria-hidden="true" />
            Kalian sama-sama ingin kenal lebih jauh.
          </p>
        ) : null}
        {stage === 5 ? (
          <p className="flex items-center gap-2 font-semibold text-brand-navy">
            <Check className="h-4 w-4 text-brand-blue" aria-hidden="true" />
            Nama depan dan foto dibagikan atas persetujuan kalian berdua.
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <Field label="Nama depan" value="Raka" open={identityOpen} />
        <Field label="Instagram" value="@contoh.raka" open={identityOpen} />
        <Field label="Telegram" value="Butuh persetujuan terpisah" open={false} />
      </div>
      <p className="mt-3 text-xs text-brand-muted">Contoh tampilan, bukan akun mahasiswa sungguhan.</p>
    </div>
  );
}

export function PrivacyReveal() {
  const [stage, setStage] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) setStage(index);
          }
        }
      },
      {
        // Di HP kartu contoh menempel di atas, jadi langkah aktif dibaca di bagian bawah layar.
        rootMargin: window.matchMedia("(min-width: 1024px)").matches
          ? "-45% 0px -45% 0px"
          : "-70% 0px -20% 0px",
      },
    );
    for (const node of stepRefs.current) if (node) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
      <div className="sticky top-[88px] z-10 self-start lg:top-28">
        <PreviewCard stage={stage} />
      </div>

      <ol className="relative">
        {steps.map((step, index) => (
          <li
            key={step.title}
            ref={(node) => {
              stepRefs.current[index] = node;
            }}
            data-index={index}
            data-active={index === stage}
            className="reveal-step flex min-h-[38vh] gap-5 py-6 lg:min-h-[58vh] lg:items-center"
          >
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 font-heading text-base font-semibold transition-colors ${
                index <= stage
                  ? "border-brand-navy bg-brand-blue text-white"
                  : "border-brand-border bg-white text-brand-muted"
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="max-w-sm pt-1.5 lg:pt-0">
              <h3 className="font-heading text-xl font-semibold text-brand-navy sm:text-2xl">
                {step.title}
              </h3>
              <p className="mt-2 leading-7 text-brand-muted">{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
