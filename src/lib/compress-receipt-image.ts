import { inferReceiptMimeType, isHeicMime } from "@/lib/receipt-mime";
import { isDirectReceiptUrl } from "@/lib/receipt-url";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350_000;

/** Shrinks phone photos before upload so submit feels much faster on Vercel. */
export async function compressReceiptFile(file: File): Promise<File> {
  const mimeType = inferReceiptMimeType(file);
  if (!mimeType.startsWith("image/")) return file;
  if (mimeType === "image/gif") return file;

  const forceJpeg = isHeicMime(mimeType);
  if (!forceJpeg && file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_DIMENSION ? MAX_DIMENSION / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob) return file;
    if (!forceJpeg && blob.size >= file.size * 0.92) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "receipt";
    return new File([blob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export async function prepareReceiptFilesForUpload(files: File[]) {
  return Promise.all(files.map((file) => compressReceiptFile(file)));
}

async function blobToJpegObjectUrl(blob: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpegBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    return jpegBlob ? URL.createObjectURL(jpegBlob) : null;
  } catch {
    return null;
  }
}

function previewMimeType(blob: Blob, fallback: string) {
  if (blob.type && blob.type !== "application/octet-stream") return blob.type;
  if (fallback.startsWith("image/")) return fallback;
  return "image/jpeg";
}

export type ReceiptPreviewResult =
  | { url: string; pending: boolean }
  | { error: true; message: string };

/** Load a receipt through the authenticated API (handles HEIC + upload delay). */
export async function loadReceiptPreviewUrl(
  receipt: { url: string; mimeType: string },
  options?: { maxAttempts?: number },
): Promise<ReceiptPreviewResult> {
  if (isDirectReceiptUrl(receipt.url)) {
    return { url: receipt.url, pending: false };
  }

  const maxAttempts = options?.maxAttempts ?? 8;
  let lastMessage = "Could not load receipt photo.";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(receipt.url, {
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 404 && attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      return { error: true, message: "Please sign in again to view receipts." };
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (body?.error) lastMessage = body.error;
      }
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      return { error: true, message: lastMessage };
    }

    if (contentType.includes("application/json")) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      return {
        error: true,
        message: body?.error ?? "Receipt photo is missing. Refile the claim.",
      };
    }

    const blob = await response.blob();
    if (blob.size === 0) {
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      return { error: true, message: lastMessage };
    }

    const mimeType = previewMimeType(blob, receipt.mimeType);

    if (isHeicMime(mimeType)) {
      const converted = await blobToJpegObjectUrl(blob);
      if (converted) return { url: converted, pending: false };
    }

    const displayBlob =
      blob.type === mimeType ? blob : new Blob([blob], { type: mimeType });
    return { url: URL.createObjectURL(displayBlob), pending: false };
  }

  return { url: "", pending: true };
}

/** Open receipt in a new browser tab (fetch with session cookie, then show image). */
export async function openReceiptInNewTab(receipt: {
  url: string;
  mimeType: string;
  fileName?: string | null;
}) {
  const result = await loadReceiptPreviewUrl(receipt, { maxAttempts: 3 });
  if ("error" in result) {
    window.alert(result.message);
    return;
  }
  if (!result.url) return;

  const tab = window.open(result.url, "_blank", "noopener,noreferrer");
  if (!tab) {
    window.alert("Allow pop-ups to open the receipt, or try again.");
  }
}
