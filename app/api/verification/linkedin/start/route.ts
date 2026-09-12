import {
  buildLinkedInAuthorizationUrl,
  getLinkedInConfig,
  LINKEDIN_STATE_COOKIE,
} from "@/lib/verification/linkedin";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function returnToVerification(request: NextRequest, result: string) {
  const destination = new URL("/app/verification", request.url);
  destination.searchParams.set("linkedin", result);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const config = getLinkedInConfig();
  if (!config) return returnToVerification(request, "unavailable");

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(
    buildLinkedInAuthorizationUrl(config, state),
  );
  response.cookies.set({
    name: LINKEDIN_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/api/verification/linkedin/callback",
  });
  return response;
}
