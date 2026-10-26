import { z } from "zod";
import { db, newId, nowIso } from "@/lib/db";
import { hashPassword, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/password";
import { conflict, validationError } from "@/lib/errors";
import type { AuthUser } from "@/lib/auth/session";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  is_demo: number;
  created_at: string;
}

export const registrationSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Use at least 2 characters for your name.")
    .max(80, "Use 80 characters or fewer."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "Use 200 characters or fewer."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function findUserByEmail(email: string): Promise<UserRecord | undefined> {
  return await db.get<UserRecord>(
    "SELECT id, email, password_hash, display_name, is_demo, created_at FROM users WHERE email = ?",
    email.trim().toLowerCase(),
  );
}

export async function createUser(input: {
  displayName: string;
  email: string;
  password?: string;
  passwordHash?: string;
  isDemo?: boolean;
}): Promise<AuthUser> {
  const email = input.email.trim().toLowerCase();
  if (await findUserByEmail(email)) {
    throw conflict("An account with that email already exists.");
  }
  if (!input.password && !input.passwordHash) {
    throw validationError("A password is required.");
  }
  const id = newId();
  await db.run(
    "INSERT INTO users (id, email, password_hash, display_name, is_demo, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    email,
    input.passwordHash ?? hashPassword(input.password!),
    input.displayName.trim(),
    input.isDemo ? 1 : 0,
    nowIso(),
  );
  return {
    id,
    email,
    displayName: input.displayName.trim(),
    isDemo: input.isDemo ?? false,
  };
}

export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  const record = await findUserByEmail(email);
  // Verify against a dummy hash when the account is missing to reduce timing differences.
  const valid = verifyPassword(password, record?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!record || !valid) return null;
  return {
    id: record.id,
    email: record.email,
    displayName: record.display_name,
    isDemo: record.is_demo === 1,
  };
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string): Promise<void> {
  const record = await db.get<UserRecord>(
    "SELECT id, email, password_hash, display_name, is_demo, created_at FROM users WHERE id = ?",
    userId,
  );
  if (!record || !verifyPassword(currentPassword, record.password_hash)) {
    throw validationError("The current password is incorrect.");
  }
  await db.run(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    hashPassword(nextPassword),
    userId,
  );
}

export async function updateDisplayName(
  userId: string,
  displayName: string,
): Promise<AuthUser> {
  const name = displayName.trim();
  if (name.length < 2 || name.length > 80) {
    throw validationError("Use between 2 and 80 characters for your name.");
  }
  const record = await db.get<UserRecord>("SELECT id, email, display_name, is_demo FROM users WHERE id = ?", userId);
  if (!record) throw validationError("That account was not found.");
  if (record.is_demo === 1) {
    throw conflict("The shared demo profile cannot be changed. Create a personal account to edit a profile.");
  }
  await db.run("UPDATE users SET display_name = ? WHERE id = ?", name, userId);
  return {
    id: record.id,
    email: record.email,
    displayName: name,
    isDemo: false,
  };
}
