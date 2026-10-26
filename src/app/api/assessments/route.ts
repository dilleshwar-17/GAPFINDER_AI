import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { startDiagnostic } from "@/lib/services/assessment";
import { quizRequestSchema } from "@/lib/ai/schemas";
import { z } from "zod";

const startSchema = quizRequestSchema.extend({
  subjectId: z.string().trim().min(1).max(64),
});

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, startSchema);
    const result = await startDiagnostic(user.id, payload.subjectId, payload.topicIds);
    return jsonOk({ result }, 201);
  });
}
