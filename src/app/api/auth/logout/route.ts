import { cookies } from "next/headers";
import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import {
  clearSessionCookie,
  deleteSessionToken,
  SESSION_COOKIE,
  getCurrentUser,
} from "@/lib/auth/session";
import { deleteInteractiveDemoWorkspace } from "@/lib/services/demo";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await getCurrentUser();
    if (user?.isDemo && !user.isReadOnlyDemo) {
      await deleteInteractiveDemoWorkspace(user.id);
    } else if (isSupabaseAuthConfigured()) {
      const supabase = await createClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    } else {
      const store = await cookies();
      const token = store.get(SESSION_COOKIE)?.value;
      if (token) await deleteSessionToken(token);
    }
    const response = jsonOk({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
