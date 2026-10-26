import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { toggleRevisionTask } from "@/lib/services/plans";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { taskId } = await context.params;
    const task = toggleRevisionTask(user.id, taskId);
    return jsonOk({ task });
  });
}
