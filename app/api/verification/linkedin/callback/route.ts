import { createClient } from "@/lib/supabase/server";
import {
  exchangeLinkedInCode,
  getLinkedInConfig,
  LINKEDIN_STATE_COOKIE,
  readLinkedInVerification,
  saveLinkedInVerification,
} from "@/lib/verification/linkedin";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function safeStateEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function returnToVerification(request: NextRequest, result: string) {
  const destination = new URL("/app/verification", request.url);
  destination.searchParams.set("linkedin", result);
  const response = NextResponse.redirect(destination);
  response.cookies.set({
    name: LINKEDIN_STATE_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/api/verification/linkedin/callback",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const suppliedState = request.nextUrl.searchParams.get("state") ?? "";
  const expectedState =
    request.cookies.get(LINKEDIN_STATE_COOKIE)?.value ?? "";
  if (
    request.nextUrl.searchParams.has("error") ||
    !suppliedState ||
    !expectedState ||
    suppliedState.length > 128 ||
    expectedState.length > 128 ||
    !safeStateEqual(expectedState, suppliedState)
  ) {
    return returnToVerification(request, "failed");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return returnToVerification(request, "login_required");
  }

  const config = getLinkedInConfig();
  const code = request.nextUrl.searchParams.get("code");
  if (!config || !code || code.length > 2_000) {
    return returnToVerification(request, "failed");
  }

  try {
    const accessToken = await exchangeLinkedInCode(config, code);
    const verification = await readLinkedInVerification(
      config,
      accessToken,
    );
    await saveLinkedInVerification(user.id, verification);
    return returnToVerification(request, "connected");
  } catch {
    return returnToVerification(request, "failed");
  }
}
