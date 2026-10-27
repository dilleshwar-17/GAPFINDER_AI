import { NextResponse } from "next/server";
import { handleRoute, jsonOk, requireSameOrigin, clientKey } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { attachSessionCookie, getCurrentUser } from "@/lib/auth/session";
import {
  createInteractiveDemoSession,
  deleteInteractiveDemoWorkspace,
} from "@/lib/services/demo";
import { AppError } from "@/lib/errors";
import { isDemoEnabled } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    const previousUser = await getCurrentUser();
    if (previousUser?.isDemo && !previousUser.isReadOnlyDemo) {
      await deleteInteractiveDemoWorkspace(previousUser.id);
    }
    const { session } = await createInteractiveDemoSession();
    const response: NextResponse = jsonOk({ destination: "/dashboard" });
    attachSessionCookie(response, request, session.token, null);
    return response;
  });
}
