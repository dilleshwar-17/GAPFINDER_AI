import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const supabaseMocks = vi.hoisted(() => ({
  configured: vi.fn(),
  getUser: vi.fn(),
}));
const cookieMocks = vi.hoisted(() => ({
  sessionToken: null as string | null,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (cookieMocks.sessionToken ? { value: cookieMocks.sessionToken } : undefined),
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: supabaseMocks.getUser },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: supabaseMocks.getUser },
  })),
  isSupabaseAuthConfigured: supabaseMocks.configured,
}));

import { proxy } from "@/proxy";
import { getCurrentUser } from "@/lib/auth/session";
import { createSession } from "@/lib/auth/session";
import { createUser } from "@/lib/services/auth";

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function setEnvironmentValue(name: string, value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(process.env, name);
  else Reflect.set(process.env, name, value);
}

afterEach(() => {
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL", originalSupabaseUrl);
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", originalSupabasePublishableKey);
  setEnvironmentValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", originalSupabaseAnonKey);
  supabaseMocks.configured.mockReset();
  supabaseMocks.getUser.mockReset();
  cookieMocks.sessionToken = null;
});

describe("Supabase session handling", () => {
  it("redirects unauthenticated protected requests instead of returning a server error", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_placeholder";
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error("Auth session missing"), {
        name: "AuthSessionMissingError",
      }),
    });

    const response = await proxy(
      new NextRequest("https://gapfinder.example/dashboard?tab=progress"),
    );

    expect(response.status).toBe(307);
    const redirect = new URL(response.headers.get("location") ?? "");
    expect(redirect.pathname).toBe("/login");
    expect(redirect.searchParams.get("next")).toBe("/dashboard?tab=progress");
  });

  it("returns no user when a page lookup has no Supabase session", async () => {
    supabaseMocks.configured.mockReturnValue(true);
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error("Auth session missing"), {
        name: "AuthSessionMissingError",
      }),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("uses a valid app demo session before the Supabase identity", async () => {
    supabaseMocks.configured.mockReturnValue(true);
    const user = await createUser({
      displayName: "Temporary demo",
      email: "demo-session-44444444-4444-4444-8444-444444444444@demo.gapfinder.local",
      password: "temporary-password",
      isDemo: true,
    });
    const session = await createSession(user.id);
    cookieMocks.sessionToken = session.token;
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: Object.assign(new Error("Auth session missing"), {
        name: "AuthSessionMissingError",
      }),
    });

    await expect(getCurrentUser()).resolves.toMatchObject({
      id: user.id,
      isDemo: true,
      isReadOnlyDemo: false,
    });
    expect(supabaseMocks.getUser).not.toHaveBeenCalled();
  });

  it("still surfaces Supabase errors other than a missing session", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_placeholder";
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Supabase request failed"),
    });

    await expect(
      proxy(new NextRequest("https://gapfinder.example/dashboard")),
    ).rejects.toThrow("Supabase request failed");
  });
});
