import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const payload = await readJson(request, schema);
    const key = `login:${clientKey(request)}:${payload.email}`;
    const limit = rateLimit(key, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again later.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password,
    });

    if (error || !data.user) {
      throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    }

    return jsonOk({ user: data.user });
  });
}
