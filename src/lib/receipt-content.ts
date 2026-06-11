import { readFile } from "fs/promises";
import path from "path";

import { isReceiptBlobPath, readReceiptBlob } from "@/lib/receipt-blob";

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

function serveBytes(buffer: Buffer, mimeType: string, disposition: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

const LEGACY_RECEIPT_ERROR =
  "This receipt photo was saved before storage was fixed. Refile the claim with a new photo.";

export async function receiptFileResponse(
  filePath: string,
  mimeType: string,
  fileName: string | null,
): Promise<Response> {
  const inlineName = (fileName ?? "receipt").replace(/"/g, "'");
  const disposition = `inline; filename="${inlineName}"`;

  if (!filePath?.trim()) {
    return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
  }

  if (isReceiptBlobPath(filePath)) {
    const blob = await readReceiptBlob(filePath);
    if (blob) {
      try {
        return serveBytes(blob.buffer, blob.mimeType || mimeType, disposition);
      } catch (serveErr) {
        console.error("receipt blob serve failed", {
          filePath: filePath.slice(0, 80),
          serveErr,
        });
      }
    }

    console.error("receipt blob not found", {
      filePath: filePath.slice(0, 120),
    });
    return Response.json(
      {
        error:
          "Receipt file is missing from storage. Submit a new claim with the photo, or refile this one.",
      },
      { status: 404 },
    );
  }

  if (filePath.startsWith("data:")) {
    const parsed = parseDataUrl(filePath);
    if (!parsed) {
      return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
    }
    return serveBytes(parsed.buffer, parsed.mimeType, disposition);
  }

  if (filePath.startsWith("/uploads/")) {
    const absolute = path.join(process.cwd(), "public", filePath);
    try {
      const buffer = await readFile(absolute);
      return serveBytes(buffer, mimeType, disposition);
    } catch {
      return Response.json(
        { error: "Receipt file is no longer on the server. Re-upload if needed." },
        { status: 404 },
      );
    }
  }

  return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
}
