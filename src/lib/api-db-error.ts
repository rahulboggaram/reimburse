import { isTransientDbError } from "@/lib/db-retry";

/** Standard JSON error for list/read APIs — 503 when the DB blips so clients can retry. */
export function apiDbErrorResponse(
  route: string,
  err: unknown,
  message: string,
) {
  console.error(`${route} failed`, err);
  if (isTransientDbError(err)) {
    return Response.json(
      { error: message, retry: true },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": "2",
        },
      },
    );
  }
  return Response.json({ error: message }, { status: 500 });
}
