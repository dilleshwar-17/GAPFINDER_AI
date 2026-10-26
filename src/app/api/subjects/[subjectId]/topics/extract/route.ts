import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { extractTopics } from "@/lib/services/topics";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { subjectId } = await context.params;
    const result = await extractTopics(user.id, subjectId);
    return jsonOk({ result });
  });
}
