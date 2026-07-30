"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { EarlyAccessTrigger } from "@/components/marketing/early-access-dialog";

type NavItem = {
  label: string;
  href: string;
};

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative lg:hidden">
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-brand-navy/20"
          aria-label="Tutup menu"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="focus-ring relative z-50 flex h-11 w-11 items-center justify-center rounded-[12px] border border-brand-border text-brand-navy"
      >
        <span className="sr-only">{open ? "Tutup menu" : "Buka menu"}</span>
        {open ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <span className="space-y-1.5" aria-hidden="true">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="block h-0.5 w-5 bg-current" />
          </span>
        )}
      </button>

      {open ? (
        <nav
          id={panelId}
          className="absolute right-0 top-14 z-50 w-64 rounded-[20px] border border-brand-border bg-white p-3 shadow-lg"
          aria-label="Mobile"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-[12px] px-4 py-3 text-sm font-medium text-brand-navy hover:bg-brand-surface"
            >
              {item.label}
            </a>
          ))}
          <EarlyAccessTrigger
            source="navbar"
            onClick={() => setOpen(false)}
            className="mt-2 block w-full rounded-[12px] bg-brand-blue px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Ikut Akses Awal
          </EarlyAccessTrigger>
        </nav>
      ) : null}
    </div>
  );
}
