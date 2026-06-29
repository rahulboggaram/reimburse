import { readFile } from "fs/promises";
import path from "path";

import { prepareReceiptImageForServe } from "@/lib/normalize-receipt-image";
import { isReceiptImageMime } from "@/lib/receipt-mime";
import { parseStoredReceiptDataUrl } from "@/lib/receipt-content-parse";
import {
  isDatabaseReceiptPath,
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

export async function receiptFileResponse(
  filePath: string,
  mimeType: string,
  fileName: string | null,
  sizeBytes?: number | null,
): Promise<Response> {
  if (!filePath?.trim()) {
    return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
  }

  if (isSupabaseReceiptPath(filePath)) {
    try {
      const downloaded = await downloadReceiptObject(filePath);
      const resolvedMime = mimeType;

      if (isReceiptImageMime(resolvedMime) || resolvedMime.includes("heic")) {
        const served = await prepareReceiptImageForServe(downloaded, resolvedMime);
        return serveReceiptBytes(
          Buffer.from(served.buffer),
          served.mimeType,
          fileName,
        );
      }

      return serveReceiptBytes(downloaded, resolvedMime, fileName);
    } catch (err) {
      console.error("receipt storage download failed", { filePath, err });
      return Response.json(
        { error: "Receipt file is missing from storage. Refile with a new photo." },
        { status: 404 },
      );
    }
  }

  if (isDatabaseReceiptPath(filePath)) {
    const parsed = parseStoredReceiptDataUrl(filePath, sizeBytes);
    if (!parsed) {
      return Response.json({ error: LEGACY_RECEIPT_ERROR }, { status: 404 });
    }

    let { buffer, mimeType: resolvedMime } = parsed;
    if (isReceiptImageMime(resolvedMime) || resolvedMime.includes("heic")) {
      const served = await prepareReceiptImageForServe(buffer, resolvedMime);
      buffer = served.buffer;
      resolvedMime = served.mimeType;
    }

    return serveReceiptBytes(buffer, resolvedMime, fileName);
  }

  if (filePath.startsWith("/uploads/")) {
    if (process.env.VERCEL) {
      return Response.json({ error: LEGACY_UPLOAD_ERROR }, { status: 404 });
    }
    const absolute = path.join(process.cwd(), "public", filePath);
    try {
      const buffer = await readFile(absolute);
      if (isReceiptImageMime(mimeType)) {
        const served = await prepareReceiptImageForServe(buffer, mimeType);
        return serveReceiptBytes(served.buffer, served.mimeType, fileName);
      }
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
