"use server";

import { unblockMyBlockedStudent } from "@/lib/account/blocks";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const aliasSchema = z.string().regex(/^Partner #[0-9]{6}$/);

export async function unblockStudentAction(
  publicAlias: string,
): Promise<{ ok: boolean; message: string }> {
  const parsed = aliasSchema.safeParse(publicAlias);
  if (!parsed.success) {
    return { ok: false, message: "Akun yang diblokir tidak valid." };
  }

  try {
    const removed = await unblockMyBlockedStudent(parsed.data);
    if (!removed) {
      return { ok: false, message: "Blokir sudah tidak aktif." };
    }
  } catch {
    return {
      ok: false,
      message: "Blokir belum dapat dibuka. Coba lagi beberapa saat.",
    };
  }

  revalidatePath("/app/settings");
  return { ok: true, message: "Blokir dibuka." };
}
