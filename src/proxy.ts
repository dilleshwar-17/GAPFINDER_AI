import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicKey } from "@/lib/supabase/config";

/**
 * Refreshes Supabase sessions and provides a fast route guard. Server pages,
 * API handlers, and services must still authenticate and enforce ownership.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/subjects",
  "/materials",
  "/diagnostics",
  "/reports",
  "/revision-plan",
  "/learn",
  "/assistant",
  "/progress",
  "/settings",
  "/onboarding",
];

const AUTH_PATHS = ["/login", "/signup"];

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPath = AUTH_PATHS.includes(pathname);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = getSupabasePublicKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    if (!isProtected || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;

  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/subjects/:path*",
    "/materials/:path*",
    "/diagnostics/:path*",
    "/reports/:path*",
    "/revision-plan/:path*",
    "/learn/:path*",
    "/assistant/:path*",
    "/progress/:path*",
    "/settings/:path*",
    "/onboarding",
  ],
};
