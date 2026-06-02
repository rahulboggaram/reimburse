export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    // Prefer a structured `{ error }` JSON response, but fall back to plain text
    // (Vercel/Next can return HTML for some 500s).
    const contentType = response.headers.get("content-type") ?? "";
    const isJson = contentType.includes("application/json");

    const jsonBody = isJson
      ? ((await response.json().catch(() => null)) as { error?: string } | null)
      : null;

    const textBody = !jsonBody
      ? await response.text().catch(() => "")
      : "";

    const message =
      jsonBody?.error ||
      textBody?.trim() ||
      `${response.status} ${response.statusText}`.trim() ||
      "Request failed";

    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
