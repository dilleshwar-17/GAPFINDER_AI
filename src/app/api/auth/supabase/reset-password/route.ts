import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";
import { authCallbackUrl } from "@/lib/supabase/redirect";

const schema = z.object({
  email: z.string().email(),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const payload = await readJson(request, schema);
    const key = `reset:${clientKey(request)}:${payload.email}`;
    const limit = rateLimit(key, 3, 60 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many reset attempts. Try again later.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo: authCallbackUrl(request.url, "/reset-password"),
    });

    if (error) {
      throw new AppError(502, "PROVIDER_UNAVAILABLE", "Password recovery could not be started. Try again later.");
    }
    return jsonOk({
      ok: true,
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  });
}
