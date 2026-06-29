/** Parse receipt data URLs stored in the database (shared by save + serve). */
export function parseStoredReceiptDataUrl(
  filePath: string,
  expectedBytes?: number | null,
): { mimeType: string; buffer: Buffer } | null {
  const comma = filePath.indexOf(",");
  if (!filePath.startsWith("data:") || comma < 0) return null;
  const header = filePath.slice(5, comma);
  let payload = filePath.slice(comma + 1).replace(/\s/g, "");
  const remainder = payload.length % 4;
  if (remainder > 0) {
    payload += "=".repeat(4 - remainder);
  }
  const mimeType =
    header.replace(/;base64$/i, "").trim() || "application/octet-stream";
  if (!payload) return null;
  try {
    const buffer = Buffer.from(payload, "base64");
    if (buffer.length === 0) return null;
    if (
      expectedBytes != null &&
      expectedBytes > 0 &&
      Math.abs(buffer.length - expectedBytes) > 512
    ) {
      return null;
    }
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

export function assertValidStoredReceiptDataUrl(
  filePath: string,
  sizeBytes: number,
) {
  const parsed = parseStoredReceiptDataUrl(filePath, sizeBytes);
  if (!parsed) {
    throw new Error("Receipt photo could not be saved correctly. Try again.");
  }
}
