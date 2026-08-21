"use server";

import { getAuthenticatedUser, getPrivateProfile } from "@/lib/auth/session";
import {
  cancelMyPayment,
  createCheckout,
  refreshMyPaymentStatus,
} from "@/lib/billing/service";
import { paymentOrderPublicIdSchema } from "@/lib/billing/validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireStudent() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  const profile = await getPrivateProfile(user.id);
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
}

export async function startMembershipCheckout() {
  await requireStudent();
  let order: Awaited<ReturnType<typeof createCheckout>>;
  try {
    order = await createCheckout();
  } catch {
    redirect("/app/membership?state=payment_unavailable");
  }
  if (!order.checkoutUrl || order.status !== "pending") {
    redirect(`/app/membership?order=${order.publicId}&state=pending`);
  }
  redirect(order.checkoutUrl);
}

export async function refreshMembershipPayment(formData: FormData) {
  await requireStudent();
  const parsed = paymentOrderPublicIdSchema.safeParse(formData.get("order"));
  if (!parsed.success) redirect("/app/membership?state=invalid");
  let state: string;
  try {
    state = (await refreshMyPaymentStatus(parsed.data))?.status ?? "unavailable";
  } catch {
    redirect(`/app/membership?order=${parsed.data}&state=payment_unavailable`);
  }
  revalidatePath("/app/membership");
  redirect(`/app/membership?order=${parsed.data}&state=${state}`);
}

export async function cancelMembershipPayment(formData: FormData) {
  await requireStudent();
  const parsed = paymentOrderPublicIdSchema.safeParse(formData.get("order"));
  if (!parsed.success) redirect("/app/membership?state=invalid");
  try {
    await cancelMyPayment(parsed.data);
  } catch {
    redirect(`/app/membership?order=${parsed.data}&state=payment_unavailable`);
  }
  revalidatePath("/app/membership");
  redirect(`/app/membership?order=${parsed.data}&state=cancelled`);
}
