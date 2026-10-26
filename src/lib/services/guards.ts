import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { forbidden } from "@/lib/errors";

/**
 * Demo accounts share one seeded workspace. These helpers keep the shared
 * reference data read-only so one visitor cannot permanently damage the demo
 * for another. They are enforced on the server, not only in the interface.
 */
export function isDemoUser(userId: string): boolean {
  const row = db.get<{ is_demo: number }>("SELECT is_demo FROM users WHERE id = ?", userId);
  return row?.is_demo === 1;
}

export function assertWritableAccount(userId: string, action: string): void {
  if (isDemoUser(userId)) {
    throw forbidden(
      `The shared demo workspace is read-only for ${action}. Create a personal account to use this action.`,
    );
  }
}

export function resolveDatabaseFile(): string | null {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured === ":memory:") return null;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
  }
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "gapfinder.db");
}

export function databaseExists(): boolean {
  const file = resolveDatabaseFile();
  return file !== null && fs.existsSync(/*turbopackIgnore: true*/ file);
}
