import { requireActiveStudentAppAccess } from "@/lib/account/guard";
import { Suspense, type ReactNode } from "react";

async function ActiveStudentGate({ children }: { children: ReactNode }) {
  await requireActiveStudentAppAccess();
  return children;
}

export default function PrivateAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">Memuat…</p>
        </main>
      }
    >
      <ActiveStudentGate>{children}</ActiveStudentGate>
    </Suspense>
  );
}
