import { NextResponse } from "next/server";
import { handleRoute, jsonOk, requireSameOrigin } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleRoute(async () => {
    requireSameOrigin(request);
    const supabase = await createClient();
    await supabase.auth.signOut();
    return jsonOk({ ok: true });
  });
}
