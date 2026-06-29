import sharp from "sharp";

import { isHeicMime, isReceiptImageMime } from "@/lib/receipt-mime";

const MAX_DIMENSION = 1600;
const FALLBACK_DIMENSION = 1024;
const JPEG_QUALITY = 82;
/** Keep DB data URLs small enough for Vercel request limits. */
const MAX_STORED_BYTES_DATABASE = 900_000;
/** Object storage can hold larger compressed screenshots. */
const MAX_STORED_BYTES_OBJECT = 2_500_000;

const PASSTHROUGH_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function normalizePassthroughMime(mimeType: string) {
  const type = mimeType.toLowerCase();
  return type === "image/jpg" ? "image/jpeg" : type;
}

function canPassthroughImage(
  buffer: Buffer,
  mimeType: string,
  maxStoredBytes: number,
) {
  const type = normalizePassthroughMime(mimeType);
  if (!PASSTHROUGH_MIME.has(type) || isHeicMime(mimeType)) {
    return false;
  }
  return buffer.length > 0 && buffer.length <= maxStoredBytes;
}

async function resizeToJpeg(
  buffer: Buffer,
  maxDimension: number,
  quality: number,
) {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(maxDimension, maxDimension, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();
}

async function encodeJpeg(buffer: Buffer, maxStoredBytes: number) {
  let quality = JPEG_QUALITY;
  let output = await resizeToJpeg(buffer, MAX_DIMENSION, quality);

  while (output.length > maxStoredBytes && quality > 40) {
    quality -= 10;
    output = await resizeToJpeg(buffer, MAX_DIMENSION, quality);
  }

  if (output.length > maxStoredBytes) {
    output = await resizeToJpeg(buffer, FALLBACK_DIMENSION, 68);
  }

  while (output.length > maxStoredBytes && quality > 36) {
    quality -= 8;
    output = await resizeToJpeg(buffer, FALLBACK_DIMENSION, quality);
  }

  if (output.length > maxStoredBytes) {
    throw new Error(
      "Photo is too large after compression. Try a smaller image.",
    );
  }

  return output;
}

function passthroughOrThrow(
  buffer: Buffer,
  mimeType: string,
  maxStoredBytes: number,
) {
  if (canPassthroughImage(buffer, mimeType, maxStoredBytes)) {
    return {
      buffer,
      mimeType: normalizePassthroughMime(mimeType),
    };
  }

  throw new Error(
    "Could not process this photo on the server. Try saving as JPG and upload again.",
  );
}

/** Convert phone photos (incl. HEIC) to JPEG when saving new receipts. */
export async function normalizeReceiptImageBuffer(
  buffer: Buffer,
  mimeType: string,
  options?: { forStorage?: boolean; objectStorage?: boolean },
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isReceiptImageMime(mimeType)) {
    return { buffer, mimeType };
  }

  const maxStoredBytes = options?.objectStorage
    ? MAX_STORED_BYTES_OBJECT
    : MAX_STORED_BYTES_DATABASE;

  try {
    const output = await encodeJpeg(buffer, maxStoredBytes);
    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt image normalize failed", { mimeType, err });
    if (options?.forStorage) {
      if (err instanceof Error && err.message.includes("too large")) {
        throw err;
      }
      return passthroughOrThrow(buffer, mimeType, maxStoredBytes);
    }
    return { buffer, mimeType };
  }
}

/** Always serve browser-friendly JPEG bytes (repairs legacy HEIC rows in the DB). */
export async function prepareReceiptImageForServe(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isReceiptImageMime(mimeType) && !isHeicMime(mimeType)) {
    return { buffer, mimeType };
  }

  try {
    const output = await encodeJpeg(buffer, MAX_STORED_BYTES_OBJECT);
    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt serve normalize failed", { mimeType, err });
    if (canPassthroughImage(buffer, mimeType, MAX_STORED_BYTES_OBJECT)) {
      return {
        buffer,
        mimeType: normalizePassthroughMime(mimeType),
      };
    }
    return { buffer, mimeType };
  }
}
