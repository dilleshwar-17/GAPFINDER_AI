import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createUserAsync, authenticateAsync, findUserByEmail } from "@/lib/services/auth";
import { ensureDemoAccount } from "@/lib/services/demo";

beforeEach(() => {
  resetDatabase();
});

describe("Authentication & Demo Services", () => {
  it("registers a new user successfully", async () => {
    const user = await createUserAsync({
      displayName: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });
    expect(user.email).toBe("jane@example.com");
    expect(user.displayName).toBe("Jane Doe");
    expect(user.isDemo).toBe(false);

    const dbUser = findUserByEmail("jane@example.com");
    expect(dbUser).toBeDefined();
    expect(dbUser?.display_name).toBe("Jane Doe");
  });

  it("prevents duplicate registration with an HTTP 409 conflict error", async () => {
    await createUserAsync({
      displayName: "First User",
      email: "duplicate@example.com",
      password: "password123",
    });

    try {
      await createUserAsync({
        displayName: "Second User",
        email: "duplicate@example.com",
        password: "password456",
      });
      expect.fail("Should have thrown duplicate user conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).status).toBe(409);
      expect((error as AppError).code).toBe("CONFLICT");
      expect((error as AppError).message).toMatch(/already exists/i);
    }
  });

  it("authenticates valid credentials correctly", async () => {
    await createUserAsync({
      displayName: "Alice",
      email: "alice@example.com",
      password: "securepassword",
    });

    const user = await authenticateAsync("alice@example.com", "securepassword");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("alice@example.com");

    const invalid = await authenticateAsync("alice@example.com", "wrongpassword");
    expect(invalid).toBeNull();
  });

  it("initializes demo workspace account safely", async () => {
    const demoUser = await ensureDemoAccount();
    expect(demoUser.email).toBe("demo@gapfinder.local");
    expect(demoUser.isDemo).toBe(true);

    // Repeated call reuses existing account without error
    const repeated = await ensureDemoAccount();
    expect(repeated.id).toBe(demoUser.id);
  });
});
