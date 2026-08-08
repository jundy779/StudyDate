import { submitStudyProgramManage } from "@/app/staff/study-program-actions";
import { OnboardingCatalogDirectory } from "@/components/staff/onboarding-catalog-directory";
import type { StaffStudyProgramOption } from "@/lib/study-program/service";

type StudyProgramDirectoryProps = {
  items: StaffStudyProgramOption[];
  selectedStatus?: StaffStudyProgramOption["status"];
  basePath: "/owner/study-programs" | "/admin/study-programs";
  state?: string;
  loadError?: string | null;
};

export function StudyProgramDirectory(props: StudyProgramDirectoryProps) {
  return (
    <OnboardingCatalogDirectory
      title="Katalog jurusan"
      description="Kelola daftar program studi / jurusan onboarding: tambah, edit, setujui usulan manual user, atau hapus. Usulan muncul saat mahasiswa mengisi jurusan di luar daftar resmi."
      entitySingular="jurusan"
      addPlaceholder="Contoh: Teknik Informatika"
      items={props.items}
      selectedStatus={props.selectedStatus}
      basePath={props.basePath}
      state={props.state}
      loadError={props.loadError}
      action={submitStudyProgramManage}
    />
  );
}
