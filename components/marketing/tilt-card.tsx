"use client";

import { useRef, type ReactNode } from "react";

/**
 * Kartu yang sedikit miring mengikuti kursor (efek 2.5D).
 * Hanya aktif untuk mouse; di layar sentuh dan mode kurangi gerakan kartu diam.
 */
export function TiltCard({
  children,
  className,
  strength = 8,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    node.style.setProperty("--tilt-y", `${(x * strength).toFixed(2)}deg`);
    node.style.setProperty("--tilt-x", `${(-y * strength).toFixed(2)}deg`);
  }

  function reset() {
    ref.current?.style.setProperty("--tilt-x", "0deg");
    ref.current?.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={reset}
      className={`tilt-card ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
