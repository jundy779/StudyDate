import { getSafeAuthenticatedDestination } from "@/lib/auth/redirect";
import { getPrivateProfile } from "@/lib/auth/session";
import { getMyAccountDeletionStatus } from "@/lib/account/lifecycle";
import {
  isAllowedStudentEmail,
  STUDENT_EMAIL_DOMAIN_ERROR,
} from "@/lib/auth/allowed-email-domains";
import { claimEarlyAccessForCurrentUser } from "@/lib/early-access/claim";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { getPostAuthenticationDestination } from "@/lib/staff/authorization";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>(["email", "magiclink"]);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");

  if (!hasEnvVars) {
    redirect("/auth/error");
  }

  const requestedDestination = getSafeAuthenticatedDestination(
    request.nextUrl.searchParams.get("next"),
  );
  const supabase = await createClient();

  let authSucceeded = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    authSucceeded = !error;
  } else if (
    tokenHash &&
    requestedType &&
    ALLOWED_OTP_TYPES.has(requestedType as EmailOtpType)
  ) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: requestedType as EmailOtpType,
    });
    authSucceeded = !error;
  }

  if (!authSucceeded) {
    redirect("/auth/error");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/error");
  }

  if (requestedDestination === "/staff") {
    redirect(await getPostAuthenticationDestination(user));
  }

  const email = user.email ?? "";
  if (!isAllowedStudentEmail(email)) {
    await supabase.auth.signOut();
    redirect(
      `/login?error=email_domain&detail=${encodeURIComponent(STUDENT_EMAIL_DOMAIN_ERROR)}`,
    );
  }

  const profile = await getPrivateProfile(user.id);
  const deletionStatus = await getMyAccountDeletionStatus();
  if (
    deletionStatus === "pending" ||
    deletionStatus === "processing" ||
    deletionStatus === "failed"
  ) {
    redirect("/account/deletion-pending");
  }
  if (profile?.deactivated_at) {
    redirect("/account/reactivate");
  }

  // Waitlist ≠ account. Claim only after a valid authenticated session proves
  // ownership of the same email. Non-waitlist users continue unchanged.
  await claimEarlyAccessForCurrentUser();

  if (!profile?.onboarding_completed_at) {
    redirect("/onboarding");
  }

  redirect(
    requestedDestination === "/onboarding" ? "/app" : requestedDestination,
  );
}
