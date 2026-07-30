import { AuthShell } from "@/components/auth/auth-shell";
import Link from "next/link";

export default function Page() {
  return (
    <AuthShell>
      <p className="section-label">Tautan tidak valid</p>
      <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em]">
        Kami belum dapat memasukkanmu
      </h1>
      <p className="mt-4 leading-7 text-brand-muted">
        Tautan masuk mungkin sudah kedaluwarsa atau telah digunakan. Minta
        tautan baru untuk mencoba lagi.
      </p>
      <Link
        href="/login"
        className="focus-ring mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-5 py-3 font-semibold text-white"
      >
        Kembali ke halaman masuk
      </Link>
    </AuthShell>
  );
}
