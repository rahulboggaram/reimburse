import { readFile } from "fs/promises";
import path from "path";

import { isReceiptImageMime } from "@/lib/receipt-mime";
import { parseStoredReceiptDataUrl } from "@/lib/receipt-content-parse";
import {
  isDatabaseReceiptPath,
  isInlineReceiptPath,
  isSupabaseReceiptPath,
} from "@/lib/receipt-store";
import { downloadReceiptObject } from "@/lib/supabase-storage";

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
      "Cache-Control": "private, max-age=3600",
    },
  });
}

const LEGACY_RECEIPT_ERROR =
  "This receipt photo could not be loaded. Refile the claim with a new photo.";

const LEGACY_UPLOAD_ERROR =
  "This receipt was saved before cloud storage was enabled. Refile with a new photo.";

type ReceiptRow = {
  filePath: string;
  mimeType: string;
  fileName: string | null;
  sizeBytes?: number | null;
  fileData?: Buffer | Uint8Array | null;
};

export async function receiptFileResponse(row: ReceiptRow): Promise<Response> {
  const fileData =
    row.fileData instanceof Uint8Array
      ? Buffer.from(row.fileData)
      : row.fileData;

  if (fileData && fileData.length > 0) {
    return serveReceiptBytes(fileData, row.mimeType, row.fileName);
  }

  const filePath = row.filePath?.trim() ?? "";
  if (!filePath) {
    return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
  }

  if (isInlineReceiptPath(filePath)) {
    return Response.json(
      { error: "Receipt bytes are missing. Refile with a new photo." },
      { status: 404 },
    );
  }

  if (isSupabaseReceiptPath(filePath)) {
    try {
      const downloaded = await downloadReceiptObject(filePath);
      return serveReceiptBytes(downloaded, row.mimeType, row.fileName);
    } catch (err) {
      console.error("receipt storage download failed", { filePath, err });
      return Response.json(
        { error: "Receipt file is missing from storage. Refile with a new photo." },
        { status: 404 },
      );
    }
  }

  if (isDatabaseReceiptPath(filePath)) {
    const parsed =
      parseStoredReceiptDataUrl(filePath, row.sizeBytes) ??
      parseStoredReceiptDataUrl(filePath);
    if (!parsed) {
      return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
    }
    return serveReceiptBytes(parsed.buffer, parsed.mimeType, row.fileName);
  }

  if (filePath.startsWith("/uploads/")) {
    if (process.env.VERCEL) {
      return Response.json({ error: LEGACY_UPLOAD_ERROR }, { status: 404 });
    }
    const absolute = path.join(process.cwd(), "public", filePath);
    try {
      const buffer = await readFile(absolute);
      return serveReceiptBytes(buffer, row.mimeType, row.fileName);
    } catch {
      return Response.json(
        { error: "Receipt file is no longer on the server. Re-upload if needed." },
        { status: 404 },
      );
    }
  }

  return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
}
