import {
  EarlyAccessQueue,
  type EarlyAccessQueueSearchParams,
} from "@/components/staff/early-access-queue";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireOwner } from "@/lib/staff/authorization";
import { Suspense } from "react";

type Props = {
  searchParams: Promise<EarlyAccessQueueSearchParams>;
};

async function OwnerEarlyAccessContent({ searchParams }: Props) {
  const access = await requireOwner();
  const query = await searchParams;

  return (
    <StaffShell role={access.role} current="early-access" access={access}>
      <EarlyAccessQueue
        access={access}
        query={query}
        basePath="/owner/early-access"
      />
    </StaffShell>
  );
}

export default function OwnerEarlyAccessPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan antrean Akses Awal…
          </p>
        </main>
      }
    >
      <OwnerEarlyAccessContent {...props} />
    </Suspense>
  );
}
