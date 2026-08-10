import { signOut } from "@/app/app/actions";
import { reactivateStudentAccountAction } from "@/app/app/profile/account-actions";
import { AccountDangerZone } from "@/components/profile/account-danger-zone";
import {
  getMyAccountDeletionStatus,
  getStudentDeactivatedAt,
} from "@/lib/account/lifecycle";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Suspense } from "react";

type ReactivatePageProps = {
  searchParams: Promise<{ error?: string }>;
};

async function ReactivateContent({ searchParams }: ReactivatePageProps) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const [deactivatedAt, deletionStatus] = await Promise.all([
    getStudentDeactivatedAt(user.id),
    getMyAccountDeletionStatus(),
  ]);
  if (deletionStatus) {
    redirect("/account/deletion-pending");
  }
  if (!deactivatedAt) {
    redirect("/app");
  }

  const query = await searchParams;
  const errorCode = query.error ?? null;

  return (
    <main className="min-h-svh bg-brand-surface">
      <div className="page-shell max-w-lg py-16 sm:py-24">
        <p className="section-label">Akun nonaktif</p>
        <h1 className="mt-4 font-heading text-4xl font-semibold tracking-[-0.03em]">
          Aktifkan kembali?
        </h1>
        <p className="mt-5 text-lg leading-8 text-brand-muted">
          Akun mahasiswamu dinonaktifkan. Data masih ada di server. Aktifkan
          kembali untuk masuk ke aplikasi, atau ajukan penghapusan permanen
          yang tidak dapat dibatalkan melalui aplikasi.
        </p>
        {errorCode === "reactivate" ? (
          <p role="alert" className="mt-4 text-sm font-semibold text-brand-error">
            Akun belum dapat diaktifkan kembali. Coba lagi beberapa saat.
          </p>
        ) : null}
        <form action={reactivateStudentAccountAction} className="mt-8">
          <button
            type="submit"
            className="focus-ring flex min-h-12 w-full items-center justify-center rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white"
          >
            Aktifkan akun
          </button>
        </form>
        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="focus-ring flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-border bg-white px-6 text-sm font-semibold text-brand-navy"
          >
            Keluar
          </button>
        </form>
        <AccountDangerZone hideDeactivate />
      </div>
    </main>
  );
}

export default function ReactivateAccountPage(props: ReactivatePageProps) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-16 text-brand-muted">Memuat…</p>
        </main>
      }
    >
      <ReactivateContent {...props} />
    </Suspense>
  );
}
