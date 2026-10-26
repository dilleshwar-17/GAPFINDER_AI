export interface ApiErrorDetails {
  [key: string]: unknown;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApiErrorDetails | undefined;

  constructor(message: string, code: string, status: number, details?: ApiErrorDetails) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    formData?: FormData;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body,
    signal: options.signal,
    credentials: "same-origin",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : null;

  if (!response.ok) {
    const envelope = payload as
      | { error?: { code?: string; message?: string; details?: ApiErrorDetails } }
      | null;
    throw new ApiRequestError(
      envelope?.error?.message ?? `The request failed (HTTP ${response.status}).`,
      envelope?.error?.code ?? "REQUEST_FAILED",
      response.status,
      envelope?.error?.details,
    );
  }

  return payload as T;
}

export function messageForError(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export function validationIssues(error: unknown): Array<{ path: string; message: string }> {
  if (!(error instanceof ApiRequestError)) return [];
  const issues = error.details?.issues;
  if (!Array.isArray(issues)) return [];
  return issues
    .filter(
      (item): item is { path: string; message: string } =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as { path?: unknown }).path === "string" &&
        typeof (item as { message?: unknown }).message === "string",
    )
    .map((item) => ({ path: item.path, message: item.message }));
}
