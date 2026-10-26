import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { submitAttempt } from "@/lib/services/assessment";
import { attemptSubmissionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ assessmentId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { assessmentId } = await context.params;
    const payload = await readJson(request, attemptSubmissionSchema);
    const result = await submitAttempt(user.id, assessmentId, payload);
    return jsonOk({ result });
  });
}
