import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createUser, registrationSchema } from "@/lib/services/auth";
import { assertEmailNotReserved } from "@/lib/services/demo-seed-guard";
import { attachSessionCookie, createSession, syncSupabaseUser } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { createClient, isSupabaseAuthConfigured } from "@/lib/supabase/server";
import { authCallbackUrl } from "@/lib/supabase/redirect";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const limit = rateLimit(`register:${clientKey(request)}`, 8, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many sign-up attempts. Try again later.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }
    const payload = await readJson(request, registrationSchema);
    assertEmailNotReserved(payload.email);

    if (isSupabaseAuthConfigured()) {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { display_name: payload.displayName },
          emailRedirectTo: authCallbackUrl(request.url, "/onboarding"),
        },
      });
      if (error) {
        throw new AppError(400, "VALIDATION_ERROR", "The account could not be created. Check the details and try again.");
      }

      const user = data.user && data.session ? syncSupabaseUser(data.user) : null;
      return jsonOk(
        { user, confirmationRequired: !data.session },
        201,
      );
    }

    const user = createUser(payload);
    const session = createSession(user.id);
    const response: NextResponse = jsonOk({ user }, 201);
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
