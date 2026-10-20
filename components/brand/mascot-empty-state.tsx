import Link from "next/link";
import type { ReactNode } from "react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

type MascotPose = "front" | "hello" | "study" | "chat";

/** Pose lama dipetakan ke ekspresi maskot vektor yang tajam di semua ukuran. */
const POSE_EXPRESSION: Record<MascotPose, MascotExpression> = {
  front: "senang",
  hello: "girang",
  study: "mikir",
  chat: "kedip",
};

type MascotEmptyStateProps = {
  pose: MascotPose;
  /** Ganti ekspresi bawaan pose bila perlu. */
  expression?: MascotExpression;
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: ReactNode;
};

export function MascotEmptyState({
  pose,
  expression,
  title,
  description,
  action,
  children,
}: MascotEmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-[22px] border-2 border-dashed border-brand-navy/15 bg-white">
      <div className="grid sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        <div className="notebook-paper flex min-h-44 items-center justify-center px-5 py-6">
          <div className="w-28 sm:w-32">
            <MascotHead expression={expression ?? POSE_EXPRESSION[pose]} />
          </div>
        </div>
        <div className="flex flex-col justify-center px-6 py-8 text-center sm:px-8 sm:text-left">
          <h2 className="font-heading text-2xl font-semibold tracking-[-0.02em] text-brand-navy">
            {title}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-brand-muted sm:mx-0">
            {description}
          </p>
          {children}
          {action ? (
            <div className="mt-5">
              <Link
                href={action.href}
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-brand-navy bg-brand-blue px-5 text-sm font-semibold text-white shadow-[3px_3px_0_#0F1B33] transition-transform hover:-translate-y-0.5"
              >
                {action.label}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
