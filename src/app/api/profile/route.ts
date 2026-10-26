import { z } from "zod";
import { handleRoute, jsonOk, readJson, requireSameOrigin } from "@/lib/http";
import { requireUser } from "@/lib/auth/session";
import { updateDisplayName } from "@/lib/services/auth";

const requestSchema = z.object({
  displayName: z.string().trim().min(2, "Use at least 2 characters.").max(80, "Use 80 characters or fewer."),
});

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await requireUser();
    const payload = await readJson(request, requestSchema);
    const updated = await updateDisplayName(user.id, payload.displayName);
    return jsonOk({ user: updated });
  });
}
