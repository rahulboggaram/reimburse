import { readFile } from "fs/promises";
import path from "path";

import { isDatabaseReceiptPath } from "@/lib/receipt-store";

function parseDataUrl(filePath: string): { mimeType: string; buffer: Buffer } | null {
  const comma = filePath.indexOf(",");
  if (!filePath.startsWith("data:") || comma < 0) return null;
  const header = filePath.slice(5, comma);
  const payload = filePath.slice(comma + 1).replace(/\s/g, "");
  const mimeType = header.replace(/;base64$/i, "").trim() || "application/octet-stream";
  if (!payload) return null;
  try {
    const buffer = Buffer.from(payload, "base64");
    if (buffer.length === 0) return null;
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

export function serveReceiptBytes(
  buffer: Buffer,
  mimeType: string,
  fileName: string | null,
) {
  const inlineName = (fileName ?? "receipt").replace(/"/g, "'");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${inlineName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const LEGACY_RECEIPT_ERROR =
  "This receipt photo could not be loaded. Refile the claim with a new photo.";

export async function receiptFileResponse(
  filePath: string,
  mimeType: string,
  fileName: string | null,
): Promise<Response> {
  if (!filePath?.trim()) {
    return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
  }

  if (isDatabaseReceiptPath(filePath)) {
    const parsed = parseDataUrl(filePath);
    if (!parsed) {
      return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
    }
    return serveReceiptBytes(parsed.buffer, parsed.mimeType, fileName);
  }

  if (filePath.startsWith("/uploads/")) {
    const absolute = path.join(process.cwd(), "public", filePath);
    try {
      const buffer = await readFile(absolute);
      return serveReceiptBytes(buffer, mimeType, fileName);
    } catch {
      return Response.json(
        { error: "Receipt file is no longer on the server. Re-upload if needed." },
        { status: 404 },
      );
    }
  }

  return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
}
