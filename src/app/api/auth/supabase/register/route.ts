import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/lib/errors";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2),
});

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
    const payload = await readJson(request, schema);
    
    const supabase = await createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          display_name: payload.displayName,
        },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) {
      throw new AppError(400, "VALIDATION_ERROR", error.message);
    }

    return jsonOk({ user: data.user }, 201);
  });
}
