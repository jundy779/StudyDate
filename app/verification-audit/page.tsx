import { VerificationForm } from "@/components/verification/verification-form";
import { notFound } from "next/navigation";

export const instant = false;

export default function VerificationAuditPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return (
    <main className="min-h-svh overflow-x-clip bg-brand-surface">
      <div className="page-shell py-8 sm:py-12">
        <p className="section-label">Local verification audit</p>
        <h1 className="mt-4 font-heading text-3xl font-semibold">
          PDDIKTI lookup dan fallback manual
        </h1>
        <div className="mt-8 max-w-3xl">
          <VerificationForm
            capabilities={{ manualCard: true, manualEmail: true, provider: true }}
          />
        </div>
      </div>
    </main>
  );
}
