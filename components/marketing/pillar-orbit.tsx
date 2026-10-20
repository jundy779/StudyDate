"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, MessageCircle, Users } from "lucide-react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

const pillars = [
  {
    id: "teman",
    label: "Cari Teman",
    icon: MessageCircle,
    expression: "kedip" as MascotExpression,
    title: "Cari teman yang nyambung",
    copy: "Lihat minat, kampus, dan alasan seseorang ingin berteman. Nama asli dan kontak belum terlihat.",
    examples: ["Teman diskusi", "Rekan proyek", "Teman ngobrol"],
    href: "/#cara-kerja",
    cta: "Lihat cara kenalan",
    position: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
  },
  {
    id: "circle",
    label: "Circle Belajar",
    icon: Users,
    expression: "mikir" as MascotExpression,
    title: "Gabung circle belajar",
    copy: "Belajar, berdiskusi, atau mengerjakan proyek bersama dalam kelompok kecil, terbuka atau satu kampus.",
    examples: ["Persiapan ujian", "Skripsi bareng", "Bahasa"],
    href: "/#groups",
    cta: "Lihat contoh circle",
    position: "left-0 bottom-[4%] sm:-translate-x-[12%]",
  },
  {
    id: "acara",
    label: "Acara Kampus",
    icon: CalendarDays,
    expression: "girang" as MascotExpression,
    title: "Temukan acara kampus",
    copy: "Seminar, workshop, meetup, sampai hackathon. Daftar, simpan tiket, lalu datang ke tempat umum.",
    examples: ["Workshop", "Hackathon", "Meetup"],
    href: "/events",
    cta: "Lihat acara mendatang",
    position: "right-0 bottom-[4%] sm:translate-x-[12%]",
  },
] as const;

export function PillarOrbit() {
  const [activeId, setActiveId] = useState<(typeof pillars)[number]["id"]>("teman");
  const active = pillars.find((pillar) => pillar.id === activeId) ?? pillars[0];

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
      <div className="relative mx-auto aspect-square w-full max-w-[420px]">
        <div className="orbit-ring" aria-hidden="true" />
        <div className="absolute inset-[22%] rounded-full bg-white shadow-[0_24px_60px_rgba(1,79,231,0.16)]" />
        <div className="absolute inset-[28%] grid place-items-center">
          <MascotHead expression={active.expression} className="w-full" />
        </div>

        <div role="tablist" aria-label="Pilih bagian StudyDate" className="contents">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            const selected = pillar.id === activeId;
            return (
              <button
                key={pillar.id}
                type="button"
                role="tab"
                id={`orbit-tab-${pillar.id}`}
                aria-selected={selected}
                aria-controls="orbit-panel"
                onClick={() => setActiveId(pillar.id)}
                className={`focus-ring absolute ${pillar.position} inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3 py-2 text-[13px] sm:min-h-12 sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm font-semibold transition-colors ${
                  selected
                    ? "border-brand-navy bg-brand-blue text-white shadow-[3px_3px_0_#0F1B33]"
                    : "border-brand-navy bg-white text-brand-navy hover:bg-[#EAF1FF]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {pillar.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="orbit-panel"
        role="tabpanel"
        aria-labelledby={`orbit-tab-${active.id}`}
        className="min-w-0"
      >
        <h3 className="font-heading text-3xl font-semibold tracking-[-0.03em] text-brand-navy sm:text-4xl">
          {active.title}
        </h3>
        <p className="mt-4 max-w-md text-lg leading-8 text-brand-muted">{active.copy}</p>
        <ul className="mt-6 flex flex-wrap gap-3" aria-label="Contoh">
          {active.examples.map((example, index) => (
            <li
              key={example}
              className="sticky-note"
              data-tone={index === 1 ? "blue" : undefined}
              style={{ "--note-rotate": `${index % 2 ? 2 : -2}deg` } as React.CSSProperties}
            >
              {example}
            </li>
          ))}
        </ul>
        <Link
          href={active.href}
          className="focus-ring mt-8 inline-flex min-h-12 items-center rounded-xl border-2 border-brand-navy bg-white px-5 font-semibold text-brand-navy shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5"
        >
          {active.cta}
        </Link>
      </div>
    </div>
  );
}
