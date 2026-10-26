export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "EXTRACTION_FAILED"
  | "INSUFFICIENT_EVIDENCE"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function unauthenticated(message = "Sign in to continue."): AppError {
  return new AppError(401, "UNAUTHENTICATED", message);
}

export function forbidden(message = "You do not have access to this resource."): AppError {
  return new AppError(403, "FORBIDDEN", message);
}

export function notFound(message = "The requested resource was not found."): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function validationError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(400, "VALIDATION_ERROR", message, details);
}

export function conflict(message: string): AppError {
  return new AppError(409, "CONFLICT", message);
}

export function errorWithDetails(
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(status, code, message, details);
}

export function insufficientEvidence(message: string): AppError {
  return new AppError(422, "INSUFFICIENT_EVIDENCE", message);
}

export function publicError(error: unknown): {
  status: number;
  body: { error: { code: ErrorCode; message: string; details?: Record<string, unknown> } };
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
      },
    };
  }

  if (error instanceof Error) {
    if (error.name === "ExtractionError") {
      return {
        status: 400,
        body: { error: { code: "EXTRACTION_FAILED", message: error.message } },
      };
    }
    if (error.name === "CitationValidationError") {
      return {
        status: 422,
        body: { error: { code: "INSUFFICIENT_EVIDENCE", message: error.message } },
      };
    }
    if (error.name === "ProviderError") {
      return {
        status: 502,
        body: { error: { code: "PROVIDER_UNAVAILABLE", message: error.message } },
      };
    }
  }

  // Unexpected errors are logged without request bodies or document text.
  console.error("[gapfinder] unhandled server error:", error instanceof Error ? error.message : "unknown");
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong while processing the request. Please try again.",
      },
    },
  };
}
