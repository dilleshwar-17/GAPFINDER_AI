import { db, newId, nowIso } from "@/lib/db";

export function recordAiEvent(input: {
  ownerId?: string | null;
  kind: string;
  provider: string;
  model: string;
  status: "ok" | "fallback" | "error";
  detail?: string;
}): void {
  try {
    db.run(
      `INSERT INTO ai_events (id, owner_id, kind, provider, model, status, detail, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      input.ownerId ?? null,
      input.kind,
      input.provider,
      input.model,
      input.status,
      input.detail ? input.detail.slice(0, 300) : null,
      nowIso(),
    );
  } catch (error) {
    // Telemetry must never break the user-facing request.
    console.error("[gapfinder] failed to record AI event", error instanceof Error ? error.message : "unknown");
  }
}
