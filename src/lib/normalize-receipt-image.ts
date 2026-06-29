import { isHeicMime, isReceiptImageMime } from "@/lib/receipt-mime";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;
/** Keep DB rows small enough for Vercel request limits and fast loads. */
const MAX_STORED_BYTES = 750_000;

let sharpLoadFailed = false;

async function loadSharp() {
  if (sharpLoadFailed) return null;
  try {
    const mod = await import("sharp");
    const factory = mod.default;
    if (typeof factory !== "function") {
      sharpLoadFailed = true;
      return null;
    }
    return factory;
  } catch (err) {
    sharpLoadFailed = true;
    console.error("sharp module unavailable", err);
    return null;
  }
}

async function encodeJpeg(sharp: typeof import("sharp").default, buffer: Buffer) {
  let quality = JPEG_QUALITY;
  let output = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  while (output.length > MAX_STORED_BYTES && quality > 48) {
    quality -= 12;
    output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality })
      .toBuffer();
  }

  if (output.length > MAX_STORED_BYTES) {
    throw new Error(
      "Photo is too large after compression. Try a smaller image.",
    );
  }

  return output;
}

/** Convert phone photos (incl. HEIC) to JPEG when saving new receipts. */
export async function normalizeReceiptImageBuffer(
  buffer: Buffer,
  mimeType: string,
  options?: { forStorage?: boolean },
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isReceiptImageMime(mimeType)) {
    return { buffer, mimeType };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    if (options?.forStorage) {
      throw new Error(
        "Could not process this photo on the server. Try saving as JPG and upload again.",
      );
    }
    return { buffer, mimeType };
  }

  try {
    const output = await encodeJpeg(sharp, buffer);
    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt image normalize failed", { mimeType, err });
    if (options?.forStorage) {
      throw new Error(
        "Could not process this photo. Try a JPG, PNG, or screenshot.",
      );
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

  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer, mimeType: "image/jpeg" };
  }

  try {
    const output = await encodeJpeg(sharp, buffer);
    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt serve normalize failed", { mimeType, err });
    return { buffer, mimeType };
  }
}
