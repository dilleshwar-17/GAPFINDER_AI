import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { assistantRequestSchema, explainTopic } from "@/lib/services/assistant";
import { getTopicContext } from "@/lib/services/topics";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, assistantRequestSchema);
    const context = getTopicContext(user.id, payload.topicId);
    const answer = await explainTopic({
      ownerId: user.id,
      subjectId: context.topic.subject_id,
      request: { topicId: payload.topicId, question: payload.question },
    });
    return jsonOk({ answer, topicName: context.topic.name, subjectName: context.subjectName });
  });
}
