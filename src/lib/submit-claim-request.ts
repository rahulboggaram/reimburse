import { readJson } from "@/lib/api";

export type ClaimSubmitResponse = {
  id: string;
  recovered?: boolean;
  receipts?: Array<{
    id: string;
    fileName: string | null;
    mimeType: string;
    url: string;
  }>;
};

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function isRetryableError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("load failed") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("504") ||
    message.includes("try again")
  );
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function submitClaimWithRetry(input: {
  url: string;
  method: "POST" | "PATCH";
  buildFormData: () => FormData;
  clientSubmitId?: string;
  maxAttempts?: number;
}): Promise<ClaimSubmitResponse> {
  const maxAttempts = input.maxAttempts ?? 5;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const formData = input.buildFormData();
    if (input.clientSubmitId) {
      formData.set("clientSubmitId", input.clientSubmitId);
    }

    try {
      const response = await fetch(input.url, {
        method: input.method,
        body: formData,
      });

      if (response.ok) {
        return readJson<ClaimSubmitResponse>(response);
      }

      const retryable = RETRYABLE_STATUS.has(response.status);
      try {
        await readJson(response);
      } catch (err) {
        lastError = err;
        if (!retryable || attempt === maxAttempts - 1) {
          throw err;
        }
      }

      if (!retryable || attempt === maxAttempts - 1) {
        throw lastError instanceof Error
          ? lastError
          : new Error("Could not save claim. Please try again.");
      }
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);
      if (!retryable || attempt === maxAttempts - 1) {
        throw err instanceof Error
          ? err
          : new Error("Could not save claim. Please try again.");
      }
    }

    await delay(600 * (attempt + 1));
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not save claim. Please try again.");
}
