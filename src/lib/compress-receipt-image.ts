const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350_000;

function isHeicLike(file: File) {
  const type = file.type.toLowerCase();
  return type === "image/heic" || type === "image/heif";
}

/** Shrinks phone photos before upload so submit feels much faster on Vercel. */
export async function compressReceiptFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/gif") return file;

  const forceJpeg = isHeicLike(file);
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

function isHeicMime(mimeType: string) {
  const type = mimeType.toLowerCase();
  return type === "image/heic" || type === "image/heif";
}

/** Load a receipt through the authenticated API (handles HEIC + upload delay). */
export async function loadReceiptPreviewUrl(
  receipt: { url: string; mimeType: string },
  options?: { maxAttempts?: number },
): Promise<{ url: string; pending: boolean } | { error: true }> {
  const maxAttempts = options?.maxAttempts ?? 8;

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
      return { error: true };
    }

    if (!response.ok) {
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
        continue;
      }
      return { error: true };
    }

    const blob = await response.blob();
    const mimeType = blob.type || receipt.mimeType;

    if (isHeicMime(mimeType)) {
      const converted = await blobToJpegObjectUrl(blob);
      if (converted) return { url: converted, pending: false };
    }

    return { url: URL.createObjectURL(blob), pending: false };
  }

  return { url: "", pending: true };
}
