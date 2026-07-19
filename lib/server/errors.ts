import "server-only";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error(
    "[flashbets-api] unexpected error",
    error instanceof Error ? { name: error.name } : { name: "UnknownError" },
  );
  return Response.json(
    { error: "The FlashBets service is temporarily unavailable", code: "UNAVAILABLE" },
    { status: 503 },
  );
}
