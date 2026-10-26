import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { createSubject, listSubjects, subjectInputSchema } from "@/lib/services/subjects";

export const runtime = "nodejs";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireUser();
    return jsonOk({ subjects: await listSubjects(user.id) });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, subjectInputSchema);
    const subject = await createSubject({
      ownerId: user.id,
      name: payload.name,
      description: payload.description,
      examDate: payload.examDate,
    });
    return jsonOk({ subject }, 201);
  });
}
