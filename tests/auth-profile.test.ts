import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { syncSupabaseUser } from "@/lib/auth/session";
import { assertWritableAccount } from "@/lib/services/guards";
import { insertSubject, insertUser } from "./fixtures";

const originalDemoEmail = process.env.SUPABASE_DEMO_EMAIL;

beforeEach(() => {
  resetDatabase();
});

afterEach(() => {
  if (originalDemoEmail === undefined) Reflect.deleteProperty(process.env, "SUPABASE_DEMO_EMAIL");
  else process.env.SUPABASE_DEMO_EMAIL = originalDemoEmail;
});

describe("syncSupabaseUser", () => {
  it("creates an app profile from a confirmed Supabase identity", async () => {
    const user = await syncSupabaseUser({
      id: "supabase-user-1",
      email: "  learner@example.com ",
      email_confirmed_at: "2026-10-26T10:00:00.000Z",
      user_metadata: { display_name: "Learner" },
      app_metadata: {},
    });

    expect(user).toEqual({
      id: "supabase-user-1",
      email: "learner@example.com",
      displayName: "Learner",
      isDemo: false,
    });
    expect(
      await db.get<{ auth_user_id: string; password_hash: string }>(
        "SELECT auth_user_id, password_hash FROM users WHERE id = ?",
        user.id,
      ),
    ).toMatchObject({ auth_user_id: user.id });
  });

  it("links a confirmed identity to the existing workspace without changing ownership ids", async () => {
    await insertUser({
      id: "legacy-user",
      email: "learner@example.com",
      isDemo: false,
      displayName: "Existing learner",
    });
    await insertSubject({ id: "existing-subject", ownerId: "legacy-user" });

    const user = await syncSupabaseUser({
      id: "supabase-user-2",
      email: "learner@example.com",
      email_confirmed_at: "2026-10-26T10:00:00.000Z",
      user_metadata: { display_name: "New provider name" },
      app_metadata: {},
    });

    expect(user.id).toBe("legacy-user");
    expect(user.displayName).toBe("Existing learner");
    expect(
      (await db.get<{ owner_id: string }>(
        "SELECT owner_id FROM subjects WHERE id = ?",
        "existing-subject",
      ))?.owner_id,
    ).toBe("legacy-user");
    expect(
      (await db.get<{ auth_user_id: string }>(
        "SELECT auth_user_id FROM users WHERE id = ?",
        "legacy-user",
      ))?.auth_user_id,
    ).toBe("supabase-user-2");
  });

  it("does not link an unconfirmed identity to an existing email", async () => {
    await insertUser({
      id: "legacy-user",
      email: "learner@example.com",
      isDemo: false,
    });

    await expect(
      syncSupabaseUser({
        id: "unconfirmed-user",
        email: "learner@example.com",
        email_confirmed_at: null,
        user_metadata: {},
        app_metadata: {},
      }),
    ).rejects.toThrowError(AppError);
    expect(
      (await db.get<{ auth_user_id: string | null }>(
        "SELECT auth_user_id FROM users WHERE id = ?",
        "legacy-user",
      ))?.auth_user_id,
    ).toBeNull();
  });

  it("marks the configured Supabase demo identity as read-only", async () => {
    process.env.SUPABASE_DEMO_EMAIL = "Shared-Demo@example.test";

    const user = await syncSupabaseUser({
      id: "supabase-demo-user",
      email: "shared-demo@example.test",
      email_confirmed_at: "2026-10-26T10:00:00.000Z",
      user_metadata: {},
      app_metadata: {},
    });

    expect(user.isDemo).toBe(true);
    expect(
      (await db.get<{ is_demo: number }>("SELECT is_demo FROM users WHERE id = ?", user.id))
        ?.is_demo,
    ).toBe(1);
    await expect(assertWritableAccount(user.id, "material uploads")).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
  });

  it("upgrades an existing configured demo profile to read-only without changing its owner id", async () => {
    process.env.SUPABASE_DEMO_EMAIL = "shared-demo@example.test";
    await insertUser({
      id: "existing-demo-user",
      email: "shared-demo@example.test",
      isDemo: false,
    });

    const user = await syncSupabaseUser({
      id: "supabase-demo-user",
      email: "shared-demo@example.test",
      email_confirmed_at: "2026-10-26T10:00:00.000Z",
      user_metadata: {},
      app_metadata: {},
    });

    expect(user).toMatchObject({ id: "existing-demo-user", isDemo: true });
    expect(
      (await db.get<{ is_demo: number }>(
        "SELECT is_demo FROM users WHERE id = ?",
        "existing-demo-user",
      ))?.is_demo,
    ).toBe(1);
  });
});
