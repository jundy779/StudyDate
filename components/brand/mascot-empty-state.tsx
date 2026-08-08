import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type MascotPose = "front" | "hello" | "study" | "chat";

type MascotEmptyStateProps = {
  pose: MascotPose;
  title: string;
  description: string;
  action?: { href: string; label: string };
  children?: ReactNode;
};

export function MascotEmptyState({
  pose,
  title,
  description,
  action,
  children,
}: MascotEmptyStateProps) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-dashed border-brand-border bg-white">
      <div className="grid sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
        <div className="flex min-h-44 items-end justify-center bg-[radial-gradient(circle_at_50%_20%,#ffffff_0%,#edf4ff_58%,#e3edfc_100%)] px-5 pt-6 pb-4">
          <Image
            src={`/brand/mascot/${pose}.png`}
            alt=""
            width={160}
            height={160}
            className="h-36 w-36 object-contain object-bottom drop-shadow-[0_10px_18px_rgba(15,27,51,0.12)]"
          />
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
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white transition-colors hover:bg-[#013FC7]"
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
