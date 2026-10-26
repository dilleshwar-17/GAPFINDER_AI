import { cookies } from "next/headers";
import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import {
  clearSessionCookie,
  deleteSessionToken,
  SESSION_COOKIE,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) deleteSessionToken(token);
    const response = jsonOk({ ok: true });
    clearSessionCookie(response);
    return response;
  });
}
