export const STUDY_STATUS_OPTIONS = [
  {
    value: "study_friend",
    label: "Lagi cari teman belajar",
  },
  {
    value: "discussion_friend",
    label: "Lagi cari teman diskusi",
  },
  {
    value: "project_friend",
    label: "Lagi cari teman ngerjain proyek",
  },
] as const;

export type StudyStatus = (typeof STUDY_STATUS_OPTIONS)[number]["value"];

const studyStatusLabels = new Map<StudyStatus, string>(
  STUDY_STATUS_OPTIONS.map((option) => [option.value, option.label]),
);

export function isStudyStatus(value: string): value is StudyStatus {
  return STUDY_STATUS_OPTIONS.some((option) => option.value === value);
}

export function getStudyStatusLabel(value: StudyStatus | null | undefined) {
  return value ? studyStatusLabels.get(value) ?? null : null;
}
