import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Fast first pass for signed-in areas. This only checks that a session cookie
 * is present; the cryptographic session check and every ownership check still
 * run in the app layout, pages and services. A forged cookie cannot read data.
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

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
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
