import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { deleteDocument } from "@/lib/services/documents";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { documentId } = await context.params;
    const result = deleteDocument(user.id, documentId);
    return jsonOk({ ok: true, subjectId: result.subjectId });
  });
}
