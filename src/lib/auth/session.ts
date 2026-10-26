import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { sessionTtlDays } from "@/lib/env";
import { unauthenticated } from "@/lib/errors";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export { SESSION_COOKIE };

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  isDemo: boolean;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  is_demo: number;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(userId: string): { token: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionTtlDays() * 24 * 60 * 60 * 1000);
  db.run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    newId(),
    userId,
    hashToken(token),
    expires.toISOString(),
    nowIso(),
  );
  return { token, expiresAt: expires.toISOString() };
}

export function findUserForSession(token: string): AuthUser | null {
  if (!token) return null;
  const row = db.get<UserRow>(
    `SELECT u.id, u.email, u.display_name, u.is_demo
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    hashToken(token),
    nowIso(),
  );
  if (!row) return null;
  return { id: row.id, email: row.email, displayName: row.display_name, isDemo: row.is_demo === 1 };
}

/**
 * The workspace layout and the page it wraps both need the signed-in user.
 * React's request-scoped cache collapses those lookups into a single session
 * query per navigation (and stays a no-op outside a render).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findUserForSession(token);
});

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthenticated();
  return user;
}

export function deleteSessionToken(token: string): void {
  db.run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
}

export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: sessionTtlDays() * 24 * 60 * 60,
  };
}

export function requestIsSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function attachSessionCookie(
  response: NextResponse,
  request: Request,
  token: string,
): void {
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(requestIsSecure(request)));
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
