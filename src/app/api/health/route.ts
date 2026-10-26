import { db } from "@/lib/db";
import { handleRoute, jsonOk } from "@/lib/http";
import { runtimeMode } from "@/lib/env";
import { demoStatus } from "@/lib/services/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    let database = "ok";
    try {
      db.get<{ value: number }>("SELECT 1 AS value");
    } catch {
      database = "error";
    }
    return jsonOk({
      status: database === "ok" ? "ok" : "degraded",
      database,
      runtime: runtimeMode(),
      demo: { enabled: demoStatus().enabled },
      time: new Date().toISOString(),
    });
  });
}
