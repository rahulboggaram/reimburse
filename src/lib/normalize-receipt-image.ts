import { isReceiptImageMime } from "@/lib/receipt-mime";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 82;

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

/** Convert phone photos (incl. HEIC) to JPEG when saving new receipts. */
export async function normalizeReceiptImageBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isReceiptImageMime(mimeType)) {
    return { buffer, mimeType };
  }

  const sharp = await loadSharp();
  if (!sharp) {
    return { buffer, mimeType };
  }

  try {
    const pipeline = sharp(buffer, { failOn: "none" }).rotate().resize(
      MAX_DIMENSION,
      MAX_DIMENSION,
      {
        fit: "inside",
        withoutEnlargement: true,
      },
    );

    const output = await pipeline.jpeg({ quality: JPEG_QUALITY }).toBuffer();

    return { buffer: output, mimeType: "image/jpeg" };
  } catch (err) {
    console.error("receipt image normalize failed", { mimeType, err });
    return { buffer, mimeType };
  }
}
