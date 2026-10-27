import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { isPostgresConfigured } from "@/lib/db";
import { forbidden } from "@/lib/errors";

const INTERACTIVE_DEMO_EMAIL = /^demo-session-[0-9a-f-]{36}@demo\.gapfinder\.local$/i;

export function isInteractiveDemoEmail(email: string): boolean {
  return INTERACTIVE_DEMO_EMAIL.test(email);
}

export async function isInteractiveDemoUser(userId: string): Promise<boolean> {
  const row = await db.get<{ is_demo: number; email: string }>(
    "SELECT is_demo, email FROM users WHERE id = ?",
    userId,
  );
  return row?.is_demo === 1 && isInteractiveDemoEmail(row.email);
}

export async function isSharedDemoUser(userId: string): Promise<boolean> {
  const row = await db.get<{ is_demo: number; email: string }>(
    "SELECT is_demo, email FROM users WHERE id = ?",
    userId,
  );
  return row?.is_demo === 1 && !isInteractiveDemoEmail(row.email);
}

export async function assertWritableAccount(userId: string, action: string): Promise<void> {
  if (await isSharedDemoUser(userId)) {
    throw forbidden(
      `The shared demo workspace is read-only for ${action}. Create a personal account to use this action.`,
    );
  }
}

export function resolveDatabaseFile(): string | null {
  if (isPostgresConfigured()) return null;
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
  if (isPostgresConfigured()) return false;
  const file = resolveDatabaseFile();
  return file !== null && fs.existsSync(/*turbopackIgnore: true*/ file);
}
