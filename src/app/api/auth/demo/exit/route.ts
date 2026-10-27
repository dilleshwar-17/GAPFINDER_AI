import { NextResponse } from "next/server";
import { handleRoute, requireSameOrigin } from "@/lib/http";
import {
  clearSessionCookie,
  getCurrentUser,
} from "@/lib/auth/session";
import { deleteInteractiveDemoWorkspace } from "@/lib/services/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const user = await getCurrentUser();
    if (user?.isDemo && !user.isReadOnlyDemo) {
      await deleteInteractiveDemoWorkspace(user.id);
    }
    const response = new NextResponse(null, { status: 204 });
    clearSessionCookie(response);
    return response;
  });
}
