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

    if (payload.mode === "general") {
      const answer = await explainTopic({
        ownerId: user.id,
        subjectId: payload.subjectId,
        request: payload,
      });
      return jsonOk({
        answer,
        topicName: "General",
        subjectName: "General Knowledge",
      });
    }

    if (!payload.topicId) {
      throw new (await import("@/lib/errors")).AppError(400, "VALIDATION_ERROR", "Select a topic or switch to General mode.");
    }

    const context = await getTopicContext(user.id, payload.topicId);
    const answer = await explainTopic({
      ownerId: user.id,
      subjectId: context.topic.subject_id,
      request: payload,
    });
    return jsonOk({ answer, topicName: context.topic.name, subjectName: context.subjectName });
  });
}
