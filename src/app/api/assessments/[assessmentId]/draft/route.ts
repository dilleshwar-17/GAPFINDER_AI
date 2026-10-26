import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { saveAttemptDraft } from "@/lib/services/assessment";
import { attemptSubmissionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ assessmentId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { assessmentId } = await context.params;
    const payload = await readJson(request, attemptSubmissionSchema);
    const saved = await saveAttemptDraft(user.id, assessmentId, payload);
    return jsonOk({ savedAt: saved.savedAt });
  });
}
