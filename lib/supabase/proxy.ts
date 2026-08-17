import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

const noIndexPrefixes = [
  "/account",
  "/admin",
  "/api",
  "/app",
  "/auth",
  "/login",
  "/onboarding",
  "/owner",
  "/protected",
  "/staff",
  "/telegram-companion-audit",
  "/verification-audit",
];

function applyRobotsBoundary(response: NextResponse, pathname: string) {
  if (
    noIndexPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute =
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/owner" ||
    pathname.startsWith("/owner/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/staff/early-access" ||
    pathname.startsWith("/staff/early-access/") ||
    pathname === "/staff/users" ||
    pathname.startsWith("/staff/users/");
  const isStaffRoute =
    pathname === "/owner" ||
    pathname.startsWith("/owner/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/staff/early-access" ||
    pathname.startsWith("/staff/early-access/") ||
    pathname === "/staff/users" ||
    pathname.startsWith("/staff/users/");

  if (!hasEnvVars) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = isStaffRoute ? "/staff/login" : "/login";
      url.search = "";
      return applyRobotsBoundary(NextResponse.redirect(url), pathname);
    }
    return applyRobotsBoundary(supabaseResponse, pathname);
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = isStaffRoute ? "/staff/login" : "/login";
    url.search = "";
    return applyRobotsBoundary(NextResponse.redirect(url), pathname);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return applyRobotsBoundary(supabaseResponse, pathname);
}
