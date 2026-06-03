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

export async function receiptFileResponse(
  filePath: string,
  mimeType: string,
  fileName: string | null,
): Promise<Response> {
  const inlineName = (fileName ?? "receipt").replace(/"/g, "'");
  const disposition = `inline; filename="${inlineName}"`;

  if (filePath.startsWith("data:")) {
    const parsed = parseDataUrl(filePath);
    if (!parsed) {
      return Response.json({ error: "Receipt unavailable" }, { status: 404 });
    }
    return new Response(new Uint8Array(parsed.buffer), {
      headers: {
        "Content-Type": parsed.mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=86400",
      },
    });
  }

  if (filePath.startsWith("/uploads/")) {
    const absolute = path.join(process.cwd(), "public", filePath);
    try {
      const buffer = await readFile(absolute);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": mimeType,
          "Content-Disposition": disposition,
          "Cache-Control": "private, max-age=86400",
        },
      });
    } catch {
      return Response.json(
        { error: "Receipt file is no longer on the server. Re-upload if needed." },
        { status: 404 },
      );
    }
  }

  return Response.json({ error: "Receipt unavailable" }, { status: 404 });
}
