import { z } from "zod";
import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { preferencesSchema, savePreferences } from "@/lib/services/preferences";
import { getSubjectOwned } from "@/lib/services/subjects";

const requestSchema = preferencesSchema.extend({
  completeOnboarding: z.boolean().optional().default(false),
  lastSubjectId: z.string().trim().min(1).max(64).nullable().optional(),
});

export const runtime = "nodejs";

export async function PUT(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, requestSchema);
    if (payload.lastSubjectId) getSubjectOwned(user.id, payload.lastSubjectId);
    const preferences = savePreferences(
      user.id,
      { minutesPerDay: payload.minutesPerDay, sessionMinutes: payload.sessionMinutes },
      { completeOnboarding: payload.completeOnboarding, lastSubjectId: payload.lastSubjectId ?? null },
    );
    return jsonOk({ preferences });
  });
}
