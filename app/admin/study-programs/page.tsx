import { StudyProgramDirectory } from "@/components/staff/study-program-directory";
import { StaffShell } from "@/components/staff/staff-shell";
import { requireActiveStaff } from "@/lib/staff/authorization";
import {
  listStaffStudyProgramOptions,
  type StudyProgramOptionStatus,
} from "@/lib/study-program/service";
import { redirect } from "next/navigation";
import { Suspense } from "react";

const STATUSES: StudyProgramOptionStatus[] = [
  "approved",
  "pending",
  "rejected",
];

type Props = {
  searchParams: Promise<{ status?: string; state?: string }>;
};

async function AdminStudyProgramsContent({ searchParams }: Props) {
  const access = await requireActiveStaff();
  if (access.role === "owner") {
    redirect("/owner/study-programs");
  }

  const query = await searchParams;
  const selected = STATUSES.includes(query.status as StudyProgramOptionStatus)
    ? (query.status as StudyProgramOptionStatus)
    : undefined;

  let items: Awaited<ReturnType<typeof listStaffStudyProgramOptions>> = [];
  let loadError: string | null = null;
  try {
    items = await listStaffStudyProgramOptions(selected);
  } catch {
    loadError =
      "Katalog jurusan belum tersedia. Terapkan migrasi study_program_options, lalu muat ulang.";
  }

  return (
    <StaffShell role={access.role} current="study-programs">
      <main className="min-h-svh bg-brand-surface">
        <StudyProgramDirectory
          items={items}
          selectedStatus={selected}
          basePath="/admin/study-programs"
          state={query.state}
          loadError={loadError}
        />
      </main>
    </StaffShell>
  );
}

export default function AdminStudyProgramsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <main className="min-h-svh bg-brand-surface">
          <p className="page-shell py-10 text-brand-muted">
            Menyiapkan katalog jurusan…
          </p>
        </main>
      }
    >
      <AdminStudyProgramsContent {...props} />
    </Suspense>
  );
}
