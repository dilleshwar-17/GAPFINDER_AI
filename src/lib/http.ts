import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { publicError, validationError, AppError } from "@/lib/errors";

export async function handleRoute<T>(
  operation: () => Promise<T>,
): Promise<NextResponse | T> {
  try {
    return await operation();
  } catch (error) {
    const { status, body } = publicError(error);
    return NextResponse.json(body, { status });
  }
}

export function jsonOk(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw validationError("The request body must be valid JSON.");
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw validationError("The request could not be validated.", { issues });
  }
  return parsed.data;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return; // Non-browser clients authenticate with the session cookie.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "FORBIDDEN", "The request origin is not valid.");
  }
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host || originHost !== host.split(",")[0].trim()) {
    throw new AppError(403, "FORBIDDEN", "Cross-origin requests are not allowed.");
  }
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

export function formatDate(iso: string | null): string {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "Not available";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function pageLabel(pageNumber: number | null): string {
  return pageNumber === null ? "page not available" : `page ${pageNumber}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
