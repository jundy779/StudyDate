import { signOut } from "@/app/app/actions";
import { getMyAccountDeletionStatus } from "@/lib/account/lifecycle";
import { getAuthenticatedUser } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

async function DeletionPendingContent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  const status = await getMyAccountDeletionStatus();
  if (!status) redirect("/app");

  return (
    <main className="min-h-svh bg-brand-surface">
      <div className="page-shell max-w-xl py-16 sm:py-24">
        <p className="section-label">Privasi akun</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em] text-brand-navy">
          Permintaan penghapusan diterima
        </h1>
        <p className="mt-5 text-lg leading-8 text-brand-muted">
          Akunmu sudah tidak aktif, profil tidak dapat ditemukan, dan akses
          normal StudyDate tidak tersedia. Penghapusan data akun sedang
          diproses oleh sistem.
        </p>
        <p className="mt-4 text-sm leading-6 text-brand-muted">
          Penghapusan akun masih diproses. Beberapa riwayat bersama dapat tetap
          tersedia dalam bentuk anonim agar konteks dan bukti keamanan tidak
          rusak.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <form action={signOut}>
            <button
              type="submit"
              className="focus-ring min-h-12 rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white"
            >
              Keluar
            </button>
          </form>
          <Link
            href="/help"
            className="focus-ring inline-flex min-h-12 items-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy"
          >
            Buka Bantuan
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function DeletionPendingPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-16 text-brand-muted">Memuat…</p>
        </main>
      }
    >
      <DeletionPendingContent />
    </Suspense>
  );
}
