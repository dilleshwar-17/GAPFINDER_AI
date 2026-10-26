import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { isSupabaseAuthConfigured } from "@/lib/supabase/server";

const originalNodeEnv = process.env.NODE_ENV;
const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const originalSupabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function setEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else Reflect.set(process.env, name, value);
}

afterEach(() => {
  setEnvironmentValue("NODE_ENV", originalNodeEnv);
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", originalSupabasePublishableKey);
});

describe("Supabase Auth configuration", () => {
  it("fails closed in production when Supabase Auth is not configured", () => {
    setEnvironmentValue("NODE_ENV", "production");
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", undefined);
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);

    try {
      isSupabaseAuthConfigured();
      throw new Error("Expected missing production configuration to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        status: 503,
        code: "PROVIDER_UNAVAILABLE",
      });
    }
  });

  it("retains the local auth fallback outside production", () => {
    setEnvironmentValue("NODE_ENV", "test");
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", undefined);
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);

    expect(isSupabaseAuthConfigured()).toBe(false);
  });

  it("recognizes configured Supabase Auth", () => {
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key-placeholder");

    expect(isSupabaseAuthConfigured()).toBe(true);
  });

  it("recognizes the Supabase publishable key used by hosted projects", () => {
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    setEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_placeholder");

    expect(isSupabaseAuthConfigured()).toBe(true);
  });
});
