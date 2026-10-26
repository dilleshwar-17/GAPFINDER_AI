export function authCallbackUrl(requestUrl: string, nextPath = "/dashboard"): string {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configuredSiteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be configured in production.");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredSiteUrl || requestUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid absolute URL.");
  }

  if (process.env.NODE_ENV === "production" && baseUrl.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must use HTTPS in production.");
  }

  const safePath =
    nextPath.startsWith("/") && !nextPath.startsWith("//") && !nextPath.includes("\\")
      ? nextPath
      : "/dashboard";
  const callbackUrl = new URL("/auth/callback", baseUrl);
  callbackUrl.searchParams.set("next", safePath);
  return callbackUrl.toString();
}
