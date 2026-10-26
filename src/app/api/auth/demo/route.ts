import { NextResponse } from "next/server";
import { handleRoute, jsonOk, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { ensureDemoAccount } from "@/lib/services/demo";
import { attachSessionCookie, createSession, syncSupabaseUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { isDemoEnabled } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    if (!isDemoEnabled()) {
      throw new AppError(404, "NOT_FOUND", "The shared demo workspace is not available.");
    }
    const limit = rateLimit(`demo:${clientKey(request)}`, 6, 10 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        "The demo workspace is rate limited. Try again in a few minutes.",
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    if (isSupabaseAuthConfigured()) {
      const email = process.env.SUPABASE_DEMO_EMAIL?.trim();
      const password = process.env.SUPABASE_DEMO_PASSWORD;
      if (!email || !password) {
        throw new AppError(503, "PROVIDER_UNAVAILABLE", "The shared demo account is not configured.");
      }
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        throw new AppError(503, "PROVIDER_UNAVAILABLE", "The shared demo account is unavailable.");
      }
      const user = await syncSupabaseUser(data.user);
      if (!user.isDemo) {
        throw new AppError(503, "PROVIDER_UNAVAILABLE", "The shared demo account is not marked as read-only.");
      }
      return jsonOk({ user, destination: "/dashboard" });
    }

    const user = await ensureDemoAccount();
    const session = await createSession(user.id);
    const response: NextResponse = jsonOk({ user, destination: "/dashboard" });
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
