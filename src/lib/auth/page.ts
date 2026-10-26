import { redirect } from "next/navigation";
import { getCurrentUser, type AuthUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/services/preferences";
import { getSubjectOwned } from "@/lib/services/subjects";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";

/**
 * Server-component auth helpers. Route protection lives in the app layout and
 * in each server page, independent of the client navigation state.
 */
export async function requirePageUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function redirectIfSignedIn(): Promise<void> {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
}

export function safeNextPath(value: string | string[] | undefined, fallback = "/dashboard"): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate) return fallback;
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }
  return candidate;
}

/** Resolves the subject a page should default to, validating ownership. */
export async function resolveSubjectId(
  user: AuthUser,
  requested: string | string[] | undefined,
): Promise<string | null> {
  const candidate = Array.isArray(requested) ? requested[0] : requested;
  if (candidate) {
    try {
      await getSubjectOwned(user.id, candidate);
      return candidate;
    } catch {
      return null;
    }
  }
  const preferences = await getPreferences(user.id);
  if (preferences.lastSubjectId) {
    try {
      await getSubjectOwned(user.id, preferences.lastSubjectId);
      return preferences.lastSubjectId;
    } catch {
      return null;
    }
  }
  return null;
}

/** Converts service errors into a 404 page for server components. */
export function pageNotFoundIfMissing(error: unknown): never {
  if (error instanceof AppError && error.status === 404) notFound();
  throw error;
}
