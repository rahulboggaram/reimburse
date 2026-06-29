import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth-api";
import { apiDbErrorResponse } from "@/lib/api-db-error";
import { canViewClaimReceipts } from "@/lib/receipt-access";
import { parseStoredReceiptDataUrl } from "@/lib/receipt-content-parse";
import {
  isDatabaseReceiptPath,
  isInlineReceiptPath,
  isSupabaseReceiptPath,
} from "@/lib/receipt-store";
import { downloadReceiptObject } from "@/lib/supabase-storage";
import { receiptPrisma } from "@/lib/receipt-db";
import { withDbRetry } from "@/lib/db-retry";

export const runtime = "nodejs";

function storageKind(filePath: string, hasBytes: boolean) {
  if (hasBytes) return "bytes";
  if (!filePath?.trim()) return "empty";
  if (isInlineReceiptPath(filePath)) return "bytes-missing";
  if (isDatabaseReceiptPath(filePath)) return "database";
  if (filePath.startsWith("/uploads/")) return "local";
  if (isSupabaseReceiptPath(filePath)) return "supabase";
  return "unknown";
}

/** JSON health check for a receipt — used when previews fail in the UI. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const session = await requireSession();
    if (session instanceof Response) return session;

    const receipt = await withDbRetry(() =>
      receiptPrisma.reimbursementReceipt.findUnique({
        where: { id },
        include: {
          reimbursement: {
            select: {
              id: true,
              employeeId: true,
              approverId: true,
              employee: { select: { role: true } },
            },
          },
        },
      }),
    );

    if (!receipt?.reimbursement) {
      return Response.json(
        { ok: false, step: "database", error: "Receipt row not found." },
        { status: 404 },
      );
    }

    if (!canViewClaimReceipts(session, receipt.reimbursement)) {
      return Response.json(
        { ok: false, step: "permission", error: "You cannot view this receipt." },
        { status: 404 },
      );
    }

    const filePath = receipt.filePath?.trim() ?? "";
    const fileData = receipt.fileData
      ? Buffer.from(receipt.fileData)
      : null;
    const kind = storageKind(filePath, Boolean(fileData?.length));

    if (fileData && fileData.length > 0) {
      return Response.json({
        ok: true,
        step: "serve",
        storage: kind,
        sizeBytes: receipt.sizeBytes,
        bytesReadable: fileData.length,
      });
    }

    if (!filePath) {
      return Response.json({
        ok: false,
        step: "storage",
        storage: kind,
        error: "No file saved for this receipt. Refile with a new photo.",
      });
    }

    if (kind === "bytes-missing") {
      return Response.json({
        ok: false,
        step: "storage",
        storage: kind,
        error:
          "Receipt column not migrated yet. Run scripts/receipt-file-data-migration.sql in Supabase, then submit a new claim.",
      });
    }

    if (kind === "unknown") {
      return Response.json({
        ok: false,
        step: "storage",
        storage: kind,
        error: "Receipt file path is invalid. Refile with a new photo.",
      });
    }

    if (kind === "local" && process.env.VERCEL) {
      return Response.json({
        ok: false,
        step: "storage",
        storage: kind,
        error: "This receipt was saved on a dev machine. Refile it.",
      });
    }

    try {
      if (kind === "supabase") {
        const buffer = await downloadReceiptObject(filePath);
        return Response.json({
          ok: buffer.length > 0,
          step: "serve",
          storage: kind,
          sizeBytes: receipt.sizeBytes,
          bytesReadable: buffer.length,
        });
      }

      if (kind === "database") {
        const parsed =
          parseStoredReceiptDataUrl(filePath, receipt.sizeBytes) ??
          parseStoredReceiptDataUrl(filePath);
        return Response.json({
          ok: Boolean(parsed && parsed.buffer.length > 0),
          step: "serve",
          storage: kind,
          sizeBytes: receipt.sizeBytes,
          bytesReadable: parsed?.buffer.length ?? 0,
          dataUrlLength: filePath.length,
        });
      }

      return Response.json({
        ok: false,
        step: "storage",
        storage: kind,
        error: "Unsupported receipt storage.",
      });
    } catch (err) {
      return Response.json({
        ok: false,
        step: "serve",
        storage: kind,
        sizeBytes: receipt.sizeBytes,
        error:
          err instanceof Error
            ? err.message
            : "Could not read receipt bytes from storage.",
      });
    }
  } catch (err) {
    return apiDbErrorResponse(
      "receipts/[id]/status",
      err,
      "Could not check receipt status.",
    );
  }
}
