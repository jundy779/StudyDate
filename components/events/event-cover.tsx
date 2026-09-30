import type { EventCategory } from "@/lib/events/constants";
import { EVENT_CATEGORY_LABELS } from "@/lib/events/presentation";
import {
  BookOpenText,
  BrainCircuit,
  Code2,
  GraduationCap,
  Languages,
  MessagesSquare,
  Network,
  Palette,
  Presentation,
  Sparkles,
  UsersRound,
} from "lucide-react";

const coverStyles: Record<
  EventCategory,
  {
    icon: typeof BookOpenText;
    background: string;
    accent: string;
  }
> = {
  study_together: {
    icon: BookOpenText,
    background: "from-[#0459d8] via-[#0874ef] to-[#43a7ff]",
    accent: "bg-[#ffdc72] text-[#23305a]",
  },
  coding_tech: {
    icon: Code2,
    background: "from-[#101b3f] via-[#173d83] to-[#0b87d9]",
    accent: "bg-[#8ee7ff] text-[#0d3155]",
  },
  design: {
    icon: Palette,
    background: "from-[#6b35d8] via-[#a946d4] to-[#f06ea9]",
    accent: "bg-[#ffe1f0] text-[#64225e]",
  },
  languages: {
    icon: Languages,
    background: "from-[#08785e] via-[#0a9a78] to-[#56c99e]",
    accent: "bg-[#d9fff0] text-[#075742]",
  },
  thesis: {
    icon: GraduationCap,
    background: "from-[#253767] via-[#405792] to-[#7186bc]",
    accent: "bg-[#f1e5be] text-[#3b3320]",
  },
  exam_prep: {
    icon: BrainCircuit,
    background: "from-[#b43a22] via-[#e45d2d] to-[#f6a03b]",
    accent: "bg-[#fff0c9] text-[#713315]",
  },
  workshop: {
    icon: Presentation,
    background: "from-[#0c588e] via-[#157db5] to-[#28a9c7]",
    accent: "bg-[#d5f7ff] text-[#10445f]",
  },
  discussion: {
    icon: MessagesSquare,
    background: "from-[#563086] via-[#7550a8] to-[#a77ad0]",
    accent: "bg-[#f0ddff] text-[#4b286e]",
  },
  networking: {
    icon: Network,
    background: "from-[#0f4868] via-[#176d91] to-[#32a0b9]",
    accent: "bg-[#d4f7fb] text-[#113f50]",
  },
  community: {
    icon: UsersRound,
    background: "from-[#236534] via-[#398b4f] to-[#71b95e]",
    accent: "bg-[#e7f8d5] text-[#234b29]",
  },
  other: {
    icon: Sparkles,
    background: "from-[#34435e] via-[#52637d] to-[#8090a7]",
    accent: "bg-white/85 text-[#253044]",
  },
};

export function EventCover({
  category,
  title,
  city,
  variant = "card",
  className = "",
}: {
  category: EventCategory;
  title: string;
  city?: string;
  variant?: "card" | "hero";
  className?: string;
}) {
  const style = coverStyles[category];
  const Icon = style.icon;
  const hero = variant === "hero";

  return (
    <div
      aria-hidden="true"
      className={`relative isolate overflow-hidden rounded-[22px] bg-gradient-to-br ${style.background} text-white shadow-[0_18px_50px_rgba(15,27,51,0.16)] ${
        hero ? "min-h-[260px] sm:min-h-[340px]" : "aspect-[16/10] min-h-[180px]"
      } ${className}`}
    >
      <div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border-[32px] border-white/10" />
      <div className="absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-white/10 blur-sm" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,transparent_52%,rgba(255,255,255,0.10)_52%,rgba(255,255,255,0.10)_54%,transparent_54%)]" />

      <div
        className={`relative flex h-full min-h-[inherit] flex-col justify-between ${
          hero ? "p-6 sm:p-9 lg:p-11" : "p-5 sm:p-6"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
            StudyDate Event
          </span>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${style.accent}`}>
            {EVENT_CATEGORY_LABELS[category]}
          </span>
        </div>

        <div className={hero ? "max-w-3xl" : "max-w-xl"}>
          <span className={`inline-flex items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 ${
            hero ? "h-14 w-14 sm:h-16 sm:w-16" : "h-11 w-11"
          }`}>
            <Icon className={hero ? "h-7 w-7 sm:h-8 sm:w-8" : "h-5 w-5"} />
          </span>
          <p className={`mt-4 line-clamp-2 break-words font-heading font-semibold leading-tight tracking-[-0.03em] ${
            hero ? "text-3xl sm:text-4xl lg:text-5xl" : "text-xl sm:text-2xl"
          }`}>
            {title}
          </p>
          {city ? (
            <p className={`mt-3 font-medium text-white/75 ${hero ? "text-sm sm:text-base" : "text-xs"}`}>
              {city}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
