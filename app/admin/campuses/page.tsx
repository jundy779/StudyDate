import { CampusDirectory } from "@/components/staff/campus-directory";
import { StaffShell } from "@/components/staff/staff-shell";
import {
  listStaffCampusOptions,
  type CampusOptionStatus,
} from "@/lib/campus/service";
import { requireActiveStaff } from "@/lib/staff/authorization";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const STATUSES: CampusOptionStatus[] = ["approved", "pending", "rejected"];

type Props = {
  searchParams: Promise<{ status?: string; state?: string }>;
};

async function AdminCampusesContent({ searchParams }: Props) {
  const access = await requireActiveStaff();
  if (access.role === "owner") {
    redirect("/owner/campuses");
  }

  const query = await searchParams;
  const selected = STATUSES.includes(query.status as CampusOptionStatus)
    ? (query.status as CampusOptionStatus)
    : undefined;

  let items: Awaited<ReturnType<typeof listStaffCampusOptions>> = [];
  let loadError: string | null = null;
  try {
    items = await listStaffCampusOptions(selected);
  } catch {
    loadError =
      "Katalog kampus belum tersedia. Terapkan migrasi campus_options, lalu muat ulang.";
  }

  return (
    <StaffShell role={access.role} current="campuses" access={access}>
      <CampusDirectory
        items={items}
        selectedStatus={selected}
        basePath="/admin/campuses"
        state={query.state}
        loadError={loadError}
      />
    </StaffShell>
  );
}

export default function AdminCampusesPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan katalog kampus...
          </p>
        </main>
      }
    >
      <AdminCampusesContent {...props} />
    </Suspense>
  );
}
