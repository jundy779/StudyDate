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
      title="Daftar jurusan"
      description="Pilihan jurusan yang muncul saat mahasiswa mengisi profil. Tambah, ubah nama, setujui usulan, atau hapus dari sini."
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
