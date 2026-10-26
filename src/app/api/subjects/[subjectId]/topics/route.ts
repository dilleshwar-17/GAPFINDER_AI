import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { createTopic, createTopicSchema } from "@/lib/services/topics";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { subjectId } = await context.params;
    const payload = await readJson(request, createTopicSchema);
    const topic = createTopic({ ownerId: user.id, subjectId, payload });
    return jsonOk({ topic }, 201);
  });
}
