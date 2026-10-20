"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MascotHead } from "@/components/brand/mascot-head";
import type { MascotExpression } from "@/lib/brand/mascot";

type Reaction = { expression: MascotExpression; line: string };

const DEFAULT_REACTIONS: Reaction[] = [
  { expression: "kaget", line: "Eh! Geli, tahu." },
  { expression: "girang", line: "Hai! Mau cari teman belajar?" },
  { expression: "kedip", line: "Namaku masih rahasia. Nanti dibuka kalau sama-sama nyaman." },
  { expression: "penasaran", line: "Kamu lagi belajar apa sekarang?" },
  { expression: "mikir", line: "Kenalan di sini mulai dari alasan, bukan dari foto." },
  { expression: "malu", line: "Udah dong coleknya. Daftar akses awal aja, yuk." },
  {
    expression: "senang",
    line: "Aku cuma maskot, bukan jaminan keamanan. Kalau ketemuan, tetap di tempat umum ya.",
  },
];

const IDLE_AFTER_MS = 14_000;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function MascotBuddy({
  greeting = "Colek aku kalau berani.",
  reactions = DEFAULT_REACTIONS,
  className,
  headClassName,
  label = "Maskot StudyDate",
}: {
  greeting?: string;
  reactions?: Reaction[];
  className?: string;
  headClassName?: string;
  label?: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const idleTimerRef = useRef<number | undefined>(undefined);
  const [expression, setExpression] = useState<MascotExpression>("senang");
  const [line, setLine] = useState(greeting);
  const [pokes, setPokes] = useState(0);
  const [bouncing, setBouncing] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [sleeping, setSleeping] = useState(false);

  const sleepingRef = useRef(false);

  const wake = useCallback(() => {
    window.clearTimeout(idleTimerRef.current);
    if (sleepingRef.current) {
      sleepingRef.current = false;
      setSleeping(false);
      setExpression("kaget");
      setLine("Eh, aku nggak tidur kok.");
    }
    idleTimerRef.current = window.setTimeout(() => {
      sleepingRef.current = true;
      setSleeping(true);
      setExpression("ngantuk");
      setLine("Zzz... colek aku kalau mau mulai.");
    }, IDLE_AFTER_MS);
  }, []);

  // Mata mengikuti kursor. Dimatikan untuk pengguna yang memilih kurangi gerakan
  // dan untuk perangkat sentuh, supaya HP tidak bekerja sia-sia.
  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || prefersReducedMotion()) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    function handleMove(event: PointerEvent) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        if (!node) return;
        const box = node.getBoundingClientRect();
        const dx = event.clientX - (box.left + box.width / 2);
        const dy = event.clientY - (box.top + box.height * 0.55);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / 420);
        node.style.setProperty("--mascot-px", `${((dx / distance) * 6 * reach).toFixed(2)}px`);
        node.style.setProperty("--mascot-py", `${((dy / distance) * 5 * reach).toFixed(2)}px`);
        node.style.setProperty("--mascot-tilt", `${((dx / distance) * 4 * reach).toFixed(2)}deg`);
      });
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("pointermove", wake, { passive: true });
    wake();
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointermove", wake);
      cancelAnimationFrame(frameRef.current);
      window.clearTimeout(idleTimerRef.current);
    };
  }, [wake]);

  // Kedipan acak supaya maskot terasa hidup, bukan gambar diam.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let timer: number;
    function schedule() {
      timer = window.setTimeout(() => {
        setBlinking(true);
        window.setTimeout(() => setBlinking(false), 150);
        schedule();
      }, 2600 + Math.random() * 3600);
    }
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  function poke() {
    const next = reactions[pokes % reactions.length];
    setPokes((count) => count + 1);
    setExpression(next.expression);
    setLine(next.line);
    sleepingRef.current = false;
    setSleeping(false);
    if (!prefersReducedMotion()) {
      setBouncing(false);
      requestAnimationFrame(() => setBouncing(true));
    }
    wake();
  }

  return (
    <div
      ref={wrapperRef}
      className={`mascot-buddy ${blinking ? "is-blinking" : ""} ${sleeping ? "is-sleeping" : ""} ${className ?? ""}`}
    >
      <p className="mascot-bubble" aria-live="polite">
        {line}
      </p>
      <button
        type="button"
        onClick={poke}
        onAnimationEnd={() => setBouncing(false)}
        className={`mascot-poke focus-ring ${bouncing ? "is-bouncing" : ""}`}
        aria-label={`Colek ${label}`}
      >
        <MascotHead expression={expression} className={headClassName} />
      </button>
    </div>
  );
}
