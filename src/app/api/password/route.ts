import { NextResponse } from "next/server";
import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser, attachSessionCookie, createSession } from "@/lib/auth/session";
import { changePassword } from "@/lib/services/auth";
import { changePasswordSchema } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    if (user.isDemo) {
      throw forbidden("The shared demo account password cannot be changed.");
    }
    const payload = await readJson(request, changePasswordSchema);
    changePassword(user.id, payload.currentPassword, payload.nextPassword);
    // Revoke every existing session, then issue a fresh one for this browser.
    db.run("DELETE FROM sessions WHERE user_id = ?", user.id);
    const session = createSession(user.id);
    const response: NextResponse = jsonOk({ ok: true });
    attachSessionCookie(response, request, session.token);
    return response;
  });
}
