import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { db, newId, nowIso } from "@/lib/db";
import { sessionTtlDays } from "@/lib/env";
import { unauthenticated } from "@/lib/errors";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { DUMMY_PASSWORD_HASH } from "@/lib/auth/password";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

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
  auth_user_id: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + sessionTtlDays() * 24 * 60 * 60 * 1000);
  await db.run(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
    newId(),
    userId,
    hashToken(token),
    expires.toISOString(),
    nowIso(),
  );
  return { token, expiresAt: expires.toISOString() };
}

export async function findUserForSession(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const row = await db.get<UserRow>(
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

export async function syncSupabaseUser(user: {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}): Promise<AuthUser> {
  const email = user.email?.trim().toLowerCase();
  if (!email) throw unauthenticated();

  const existing = await db.get<UserRow>(
    `SELECT id, email, display_name, is_demo, auth_user_id
       FROM users
      WHERE auth_user_id = ? OR email = ?
      ORDER BY CASE WHEN auth_user_id = ? THEN 0 ELSE 1 END
      LIMIT 1`,
    user.id,
    email,
    user.id,
  );

  if (existing?.auth_user_id && existing.auth_user_id !== user.id) {
    throw unauthenticated();
  }
  if (existing && !existing.auth_user_id && !user.email_confirmed_at) {
    throw unauthenticated();
  }

  const metadataName =
    (typeof user.user_metadata.display_name === "string" &&
    user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : null) ??
    (typeof user.user_metadata.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : null);
  const displayName = existing?.display_name ?? metadataName ?? email.split("@")[0];
  const isDemo = existing?.is_demo === 1 || user.app_metadata.is_demo === true;

  if (existing) {
    await db.run(
      "UPDATE users SET auth_user_id = ?, email = ?, is_demo = ? WHERE id = ?",
      user.id,
      email,
      isDemo ? 1 : 0,
      existing.id,
    );
    return { id: existing.id, email, displayName, isDemo };
  }

  await db.run(
    `INSERT INTO users (id, email, password_hash, display_name, is_demo, auth_user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    user.id,
    email,
    DUMMY_PASSWORD_HASH,
    displayName,
    isDemo ? 1 : 0,
    user.id,
    nowIso(),
  );
  return { id: user.id, email, displayName, isDemo };
}

/**
 * The workspace layout and the page it wraps both need the signed-in user.
 * React's request-scoped cache collapses those lookups into a single session
 * query per navigation (and stays a no-op outside a render).
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error && error.name !== "AuthSessionMissingError") throw error;
    return user ? syncSupabaseUser(user) : null;
  }

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

export async function deleteSessionToken(token: string): Promise<void> {
  await db.run("DELETE FROM sessions WHERE token_hash = ?", hashToken(token));
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
