import { prisma } from "@/lib/db";
import type { ReceiptInput } from "@/lib/receipt-input";
import {
  deleteReceiptFilesForClaim,
  saveReceiptFiles,
  saveReceiptInputs,
  validateReceiptFiles,
  validateReceiptInputs,
} from "@/lib/receipt-files";

export async function replaceClaimReceiptsFromInputs(
  reimbursementId: string,
  inputs: ReceiptInput[],
): Promise<string | null> {
  if (inputs.length === 0) {
    return "Add at least one receipt photo.";
  }

  const validationError = validateReceiptInputs(inputs);
  if (validationError) return validationError;

  await prisma.reimbursementReceipt.deleteMany({
    where: { reimbursementId },
  });
  await deleteReceiptFilesForClaim(reimbursementId);

  const saved = await saveReceiptInputs(reimbursementId, inputs);
  if (saved.length > 0) {
    await prisma.reimbursementReceipt.createMany({
      data: saved.map((file) => ({
        reimbursementId,
        filePath: file.filePath,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      })),
    });
  }

  return null;
}

export async function finalizeClaimInBackground(input: {
  claimId: string;
  receiptInputs: ReceiptInput[];
  adminActorId?: string;
}) {
  const { claimId, receiptInputs, adminActorId } = input;

  try {
    const receiptError = await replaceClaimReceiptsFromInputs(
      claimId,
      receiptInputs,
    );
    if (receiptError) {
      await prisma.reimbursement.delete({ where: { id: claimId } });
      console.error("background receipt save failed", { claimId, receiptError });
      return;
    }

    if (adminActorId) {
      const { tryAutoPayAdminClaim } = await import("@/lib/admin-auto-payout");
      const payoutResult = await tryAutoPayAdminClaim(claimId, adminActorId);
      if (!payoutResult.ok && "error" in payoutResult) {
        console.error("background admin payout failed", {
          claimId,
          error: payoutResult.error,
        });
      }
    }
  } catch (err) {
    console.error("background claim finalize failed", { claimId, err });
    await prisma.reimbursement
      .delete({ where: { id: claimId } })
      .catch((deleteErr) => {
        console.error("could not roll back claim after finalize failure", {
          claimId,
          deleteErr,
        });
      });
  }
}

export async function finalizeRefileInBackground(input: {
  claimId: string;
  receiptInputs: ReceiptInput[];
  adminActorId?: string;
}) {
  const { claimId, receiptInputs, adminActorId } = input;

  try {
    const receiptError = await replaceClaimReceiptsFromInputs(
      claimId,
      receiptInputs,
    );
    if (receiptError) {
      console.error("background refile receipt save failed", {
        claimId,
        receiptError,
      });
      return;
    }

    if (adminActorId) {
      const { tryAutoPayAdminClaim } = await import("@/lib/admin-auto-payout");
      const payoutResult = await tryAutoPayAdminClaim(claimId, adminActorId);
      if (!payoutResult.ok && "error" in payoutResult) {
        console.error("background admin payout failed", {
          claimId,
          error: payoutResult.error,
        });
      }
    }
  } catch (err) {
    console.error("background refile finalize failed", { claimId, err });
  }
}

export async function replaceClaimReceipts(
  reimbursementId: string,
  files: File[],
): Promise<Response | null> {
  const validationError = validateReceiptFiles(files);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const inputs = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const error = await replaceClaimReceiptsFromInputs(reimbursementId, inputs);
  if (error) {
    return Response.json({ error }, { status: 400 });
  }
  return null;
}
