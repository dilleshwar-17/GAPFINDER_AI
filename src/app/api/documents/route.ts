import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { documentKindSchema, ingestDocument } from "@/lib/services/documents";
import { validationError } from "@/lib/errors";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    const subjectId = form.get("subjectId");
    const kindRaw = form.get("kind");

    if (!(file instanceof File)) {
      throw validationError("Choose a PDF, TXT or Markdown file to upload.");
    }
    if (typeof subjectId !== "string" || !subjectId.trim()) {
      throw validationError("Choose the subject this material belongs to.");
    }
    const kind = documentKindSchema.safeParse(typeof kindRaw === "string" ? kindRaw : "");
    if (!kind.success) {
      throw validationError("Choose whether this file is a syllabus, notes, past paper or other material.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const document = await ingestDocument({
      ownerId: user.id,
      subjectId,
      filename: file.name,
      mimeType: file.type,
      kind: kind.data,
      bytes,
    });
    return jsonOk({ document }, 201);
  });
}
