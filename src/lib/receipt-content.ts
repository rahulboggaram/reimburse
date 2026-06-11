import { readFile } from "fs/promises";
import path from "path";

function parseDataUrl(filePath: string): { mimeType: string; buffer: Buffer } | null {
  const comma = filePath.indexOf(",");
  if (!filePath.startsWith("data:") || comma < 0) return null;
  const header = filePath.slice(5, comma);
  const payload = filePath.slice(comma + 1);
  const mimeType = header.replace(/;base64$/i, "").trim() || "application/octet-stream";
  try {
    return {
      mimeType,
      buffer: Buffer.from(payload, "base64"),
    };
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

export async function receiptFileResponse(
  filePath: string,
  mimeType: string,
  fileName: string | null,
): Promise<Response> {
  const inlineName = (fileName ?? "receipt").replace(/"/g, "'");
  const disposition = `inline; filename="${inlineName}"`;

  if (filePath.startsWith("data:")) {
    const parsed = parseDataUrl(filePath);
    if (!parsed || parsed.buffer.length === 0) {
      return Response.json({ error: "Receipt unavailable" }, { status: 404 });
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

  return Response.json({ error: "Receipt unavailable" }, { status: 404 });
}
