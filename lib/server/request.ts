import "server-only";

import { ApiError } from "@/lib/server/errors";

const MAX_JSON_BYTES = 4_096;

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw new ApiError("INVALID_ORIGIN", "Same-origin request required", 403);
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError("INVALID_CONTENT_TYPE", "JSON request body required", 415);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new ApiError("BODY_TOO_LARGE", "Request body is too large", 413);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) {
    throw new ApiError("BODY_TOO_LARGE", "Request body is too large", 413);
  }

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("not an object");
    }
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError("INVALID_JSON", "A valid JSON object is required", 400);
  }
}
