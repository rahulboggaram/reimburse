import { prisma } from "@/lib/db";
import type { ReceiptInput } from "@/lib/receipt-input";
import {
  deleteReceiptFilesForClaim,
  deleteStoredReceiptFiles,
  saveReceiptFiles,
  saveReceiptInputs,
  validateReceiptFiles,
  validateReceiptInputs,
} from "@/lib/receipt-files";

function receiptSaveErrorMessage(err: unknown) {
  if (err instanceof Error) {
    if (err.message.includes("too large")) return err.message;
    if (err.message.includes("empty")) return err.message;
  }
  return "Could not save receipt photos. Try smaller images and submit again.";
}

export async function replaceClaimReceiptsFromInputs(
  reimbursementId: string,
  inputs: ReceiptInput[],
): Promise<string | null> {
  if (inputs.length === 0) {
    return "Add at least one receipt photo.";
  }

  const validationError = validateReceiptInputs(inputs);
  if (validationError) return validationError;

  const existingReceipts = await prisma.reimbursementReceipt.findMany({
    where: { reimbursementId },
    select: { filePath: true },
  });

  let saved;
  try {
    saved = await saveReceiptInputs(reimbursementId, inputs);
  } catch (err) {
    console.error("receipt save failed", { reimbursementId, err });
    return receiptSaveErrorMessage(err);
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.reimbursementReceipt.deleteMany({
        where: { reimbursementId },
      });
      for (const file of saved) {
        await tx.reimbursementReceipt.create({
          data: {
            reimbursementId,
            filePath: file.filePath,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          },
        });
      }
    });
  } catch (err) {
    console.error("receipt database write failed", { reimbursementId, err });
    return receiptSaveErrorMessage(err);
  }

  await deleteStoredReceiptFiles(
    existingReceipts.map((receipt) => receipt.filePath),
  );
  await deleteReceiptFilesForClaim(reimbursementId);

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
