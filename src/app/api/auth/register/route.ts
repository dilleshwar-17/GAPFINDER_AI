import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createUser, registrationSchema } from "@/lib/services/auth";
import { assertEmailNotReserved } from "@/lib/services/demo-seed-guard";
import { attachSessionCookie, createSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

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
    const user = createUser(payload);
    const session = createSession(user.id);
    const response: NextResponse = jsonOk({ user }, 201);
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
