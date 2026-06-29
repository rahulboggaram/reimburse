import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import { loadReceiptPhotoBytes } from "@/lib/receipt-photos";
import { isDatabaseReceiptPath, isSupabaseReceiptPath } from "@/lib/receipt-store";
import { withDbRetry } from "@/lib/db-retry";

export const runtime = "nodejs";

function storageKind(filePath: string) {
  if (!filePath?.trim()) return "empty";
  if (isSupabaseReceiptPath(filePath)) return "supabase";
  if (isDatabaseReceiptPath(filePath)) return "legacy-text";
  if (filePath.startsWith("/uploads/")) return "local";
  return "unknown";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const session = await requireSession();
    if (session instanceof Response) return session;

    const receipt = await withDbRetry(() =>
      prisma.reimbursementReceipt.findUnique({
        where: { id },
        include: {
          reimbursement: {
            select: {
              employeeId: true,
              approverId: true,
              employee: { select: { role: true } },
            },
          },
        },
      }),
    );

    if (!receipt?.reimbursement) {
      return Response.json({ ok: false, error: "Receipt not found." }, { status: 404 });
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json({ ok: false, error: "Not allowed." }, { status: 404 });
    }

    const bytes = await loadReceiptPhotoBytes({
      filePath: receipt.filePath,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
      sizeBytes: receipt.sizeBytes,
    });

    return Response.json({
      ok: true,
      storage: storageKind(receipt.filePath),
      sizeBytes: receipt.sizeBytes,
      bytesReadable: bytes.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load receipt photo.";
    return Response.json({
      ok: false,
      error: message,
    });
  }
}
