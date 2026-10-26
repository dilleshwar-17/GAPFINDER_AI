import { cookies } from "next/headers";
import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import {
  clearSessionCookie,
  deleteSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth/session";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    if (isSupabaseAuthConfigured()) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      return jsonOk({ ok: true });
    }

    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) deleteSessionToken(token);
    const response = jsonOk({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
