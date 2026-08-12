"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const requestIdSchema = z.string().uuid();

export async function cancelVerificationRequest(formData: FormData) {
  const requestId = requestIdSchema.safeParse(formData.get("requestId"));
  if (!requestId.success) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.rpc("cancel_student_verification_request", {
    p_request_id: requestId.data,
  });
  revalidatePath("/app/verification");
}
