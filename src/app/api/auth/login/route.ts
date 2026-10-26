import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { authenticate, loginSchema } from "@/lib/services/auth";
import { attachSessionCookie, createSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const payload = await readJson(request, loginSchema);
    const key = `login:${clientKey(request)}:${payload.email}`;
    const limit = rateLimit(key, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(429, "RATE_LIMITED", "Too many sign-in attempts. Try again later.", {
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const user = authenticate(payload.email, payload.password);
    if (!user) {
      throw new AppError(401, "UNAUTHENTICATED", "Email or password is incorrect.");
    }
    const session = createSession(user.id);
    const response: NextResponse = jsonOk({ user });
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
