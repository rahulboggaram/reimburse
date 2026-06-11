import { isReceiptImageMime } from "@/lib/receipt-mime";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

async function loadSharp() {
  const mod = await import("sharp");
  return mod.default;
}

/** Convert phone photos (incl. HEIC) to a browser-friendly JPEG for storage and preview. */
export async function normalizeReceiptImageBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isReceiptImageMime(mimeType)) {
    return { buffer, mimeType };
  }

  try {
    const sharp = await loadSharp();
    const output = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();

    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt image normalize failed", { mimeType, err });
    return { buffer, mimeType };
  }
}
