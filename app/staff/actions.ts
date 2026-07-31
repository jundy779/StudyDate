"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function staffSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
