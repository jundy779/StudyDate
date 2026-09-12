"use server";

import { createClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/admin";
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

export async function unlinkLinkedInVerification() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const admin = createServerAdminClient();
  if (!admin) return;
  await admin
    .from("linkedin_verification_links")
    .delete()
    .eq("user_id", user.id);
  revalidatePath("/app/verification");
}
