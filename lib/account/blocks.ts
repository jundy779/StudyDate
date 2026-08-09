import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BlockedStudent = {
  publicAlias: string;
  campus: string;
  studyProgram: string;
  semester: number | null;
  avatarMascot: string | null;
  blockedAt: string;
};

type BlockedStudentRow = {
  public_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  avatar_mascot: string | null;
  blocked_at: string;
};

export async function listMyBlockedStudents(): Promise<BlockedStudent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_blocked_students");
  if (error) {
    throw new Error("Blocked students unavailable.");
  }

  return ((data ?? []) as BlockedStudentRow[]).map((row) => ({
    publicAlias: row.public_alias,
    campus: row.campus,
    studyProgram: row.study_program,
    semester: row.semester,
    avatarMascot: row.avatar_mascot,
    blockedAt: row.blocked_at,
  }));
}

export async function unblockMyBlockedStudent(publicAlias: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unblock_my_blocked_student", {
    p_public_alias: publicAlias,
  });
  if (error) {
    throw new Error("Unblock failed.");
  }
  return data === true;
}
