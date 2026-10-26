import { z } from "zod";
import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { createRevisionPlan, planRequestSchema } from "@/lib/services/plans";

const requestSchema = planRequestSchema.extend({
  subjectId: z.string().trim().min(1).max(64),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, requestSchema);
    const plan = await createRevisionPlan({
      ownerId: user.id,
      subjectId: payload.subjectId,
      request: {
        examDate: payload.examDate,
        minutesPerDay: payload.minutesPerDay,
        sessionMinutes: payload.sessionMinutes,
      },
      trigger: "manual",
    });
    return jsonOk({ plan }, 201);
  });
}
