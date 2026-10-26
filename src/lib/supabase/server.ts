import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AppError } from "@/lib/errors";
import { getSupabasePublicKey } from "@/lib/supabase/config";

export function isSupabaseAuthConfigured(): boolean {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      getSupabasePublicKey(),
  );
  if (!configured && process.env.NODE_ENV === "production") {
    throw new AppError(
      503,
      "PROVIDER_UNAVAILABLE",
      "Supabase Auth is required in production but is not configured.",
    );
  }
  return configured;
}

function getSupabaseConfig(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = getSupabasePublicKey();
  if (!url || !anonKey) {
    throw new AppError(
      503,
      "PROVIDER_UNAVAILABLE",
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return { url, anonKey };
}

export async function createClient() {
  const { url, anonKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; proxy refreshes sessions.
        }
      },
    },
  });
}
