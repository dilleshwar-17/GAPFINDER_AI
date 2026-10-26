import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/page";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next") ?? undefined);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (user) await syncSupabaseUser(user);
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(new URL("/auth/auth-code-error", request.url));
}
