import { MAX_RECEIPT_FILE_BYTES } from "@/lib/receipt-limits";
import { inferReceiptMimeType, isHeicMime } from "@/lib/receipt-mime";

const MAX_DIMENSION = 1600;
const LARGE_FILE_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 350_000;

/** Shrinks phone photos before upload so submit stays under Vercel's body limit. */
export async function compressReceiptFile(file: File): Promise<File> {
  const mimeType = inferReceiptMimeType(file);
  if (!mimeType.startsWith("image/")) return file;
  if (mimeType === "image/gif") return file;

  const forceJpeg = isHeicMime(mimeType);
  const oversized = file.size > MAX_RECEIPT_FILE_BYTES;
  if (!forceJpeg && !oversized && file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = oversized ? LARGE_FILE_DIMENSION : MAX_DIMENSION;
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
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

    let quality = oversized ? 0.72 : JPEG_QUALITY;
    let blob: Blob | null = null;

    while (quality >= 0.48) {
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", quality);
      });
      if (!blob) break;
      if (!oversized || blob.size <= MAX_RECEIPT_FILE_BYTES) break;
      quality -= 0.08;
    }

    if (!blob) return file;
    if (!forceJpeg && !oversized && blob.size >= file.size * 0.92) return file;

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

/** Open receipt in a new browser tab (same login session). */
export function openReceiptInNewTab(receipt: {
  url: string;
  mimeType: string;
  fileName?: string | null;
}) {
  if (!receipt.url) return;
  const tab = window.open(receipt.url, "_blank", "noopener,noreferrer");
  if (!tab) {
    window.alert("Allow pop-ups to open the receipt, or try again.");
  }
}
