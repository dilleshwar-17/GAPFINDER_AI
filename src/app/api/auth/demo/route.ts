import { NextResponse } from "next/server";
import { handleRoute, jsonOk, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { ensureDemoAccount } from "@/lib/services/demo";
import { attachSessionCookie, createSession } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const limit = rateLimit(`demo:${clientKey(request)}`, 6, 10 * 60 * 1000);
    if (!limit.allowed) {
      throw new AppError(
        429,
        "RATE_LIMITED",
        "The demo workspace is rate limited. Try again in a few minutes.",
        { retryAfterSeconds: limit.retryAfterSeconds },
      );
    }

    const user = await ensureDemoAccount();
    const session = createSession(user.id);
    const response: NextResponse = jsonOk({ user, destination: "/dashboard" });
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
