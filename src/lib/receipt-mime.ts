const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

export function inferReceiptMimeType(file: { type: string; name: string }) {
  const type = file.type.trim().toLowerCase();
  if (type && type !== "application/octet-stream") return type;

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "";
}

export function isHeicMime(mimeType: string) {
  const type = mimeType.toLowerCase();
  return type === "image/heic" || type === "image/heif";
}

export function isReceiptImageMime(mimeType: string) {
  return mimeType.startsWith("image/") && mimeType !== "image/gif";
}
