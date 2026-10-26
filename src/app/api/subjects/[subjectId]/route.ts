import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { deleteSubject, updateSubject } from "@/lib/services/subjects";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(2, "Give the subject a name.").max(100),
  description: z.string().trim().max(500).optional().default(""),
  examDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { subjectId } = await context.params;
    const payload = await readJson(request, updateSchema);
    const subject = updateSubject(user.id, subjectId, {
      name: payload.name,
      description: payload.description,
      examDate: payload.examDate,
    });
    return jsonOk({ subject });
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ subjectId: string }> },
) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const { subjectId } = await context.params;
    deleteSubject(user.id, subjectId);
    return jsonOk({ ok: true });
  });
}
