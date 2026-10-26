import { createBrowserClient } from '@supabase/ssr'
import { getSupabasePublicKey } from "@/lib/supabase/config";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = getSupabasePublicKey()
  if (!url || !anonKey) {
    throw new Error(
      "Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    )
  }

  return createBrowserClient(
    url,
    anonKey
  )
}
