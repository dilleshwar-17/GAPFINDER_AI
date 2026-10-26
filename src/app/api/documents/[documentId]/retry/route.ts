import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { retryDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { documentId } = await context.params;
    const document = await retryDocument(user.id, documentId);
    return jsonOk({ document });
  });
}
