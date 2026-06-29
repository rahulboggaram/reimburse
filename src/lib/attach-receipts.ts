import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { withDbRetry } from "@/lib/db-retry";
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
    const message = err.message.trim();
    if (!message) {
      return "Could not save receipt photos. Try smaller images and submit again.";
    }
    if (
      message.toLowerCase().includes("unable to start a transaction") ||
      message.toLowerCase().includes("transaction api error")
    ) {
      return "The database was briefly busy. Tap Retry upload — your Wi‑Fi is not the problem.";
    }
    if (
      message.includes("too large") ||
      message.includes("empty") ||
      message.includes("process this photo") ||
      message.includes("upload receipt")
    ) {
      return message;
    }
    if (message.toLowerCase().includes("bucket not found")) {
      return "Receipt cloud storage is not set up yet. Your admin needs to create the receipts bucket in Supabase.";
    }
    if (message.length <= 160) {
      return message;
    }
  }
  return "Could not save receipt photos. Try smaller images and submit again.";
}

type CreateClaimWithReceiptsInput = {
  employeeId: string;
  employeeName: string;
  amount: number;
  branchId: string;
  category: string;
  description: string;
  expenseDate: Date;
  approverId: string;
  paymentApproverId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  decidedAt: Date | null;
  clientSubmitId?: string | null;
  receiptInputs: ReceiptInput[];
};

/** Create claim + receipt rows together so a DB blip cannot leave a claim without photos. */
export async function createReimbursementWithReceipts(
  input: CreateClaimWithReceiptsInput,
): Promise<{ claim: { id: string } } | { error: string }> {
  const validationError = validateReceiptInputs(input.receiptInputs);
  if (validationError) return { error: validationError };

  const claimId = randomUUID();

  let saved;
  try {
    saved = await saveReceiptInputs(claimId, input.receiptInputs);
  } catch (err) {
    console.error("receipt save failed before claim create", { claimId, err });
    return { error: receiptSaveErrorMessage(err) };
  }

  try {
    const created = await withDbRetry(() =>
      prisma.reimbursement.create({
        data: {
          id: claimId,
          employeeId: input.employeeId,
          employeeName: input.employeeName,
          amount: input.amount,
          branchId: input.branchId,
          category: input.category,
          description: input.description,
          expenseDate: input.expenseDate,
          approverId: input.approverId,
          paymentApproverId: input.paymentApproverId,
          status: input.status,
          decidedAt: input.decidedAt,
          clientSubmitId: input.clientSubmitId ?? null,
        },
      }),
    );

    try {
      for (const file of saved) {
        await withDbRetry(() =>
          prisma.reimbursementReceipt.create({
            data: {
              reimbursementId: created.id,
              filePath: file.filePath,
              fileData: file.fileData ? new Uint8Array(file.fileData) : undefined,
              fileName: file.fileName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
            },
          }),
        );
      }
    } catch (receiptErr) {
      await prisma.reimbursement
        .delete({ where: { id: claimId } })
        .catch((deleteErr) => {
          console.error("could not roll back claim after receipt insert failed", {
            claimId,
            deleteErr,
          });
        });
      throw receiptErr;
    }

    return { claim: created };
  } catch (err) {
    console.error("atomic claim create failed", { claimId, err });
    await deleteStoredReceiptFiles(saved.map((file) => file.filePath));
    await deleteReceiptFilesForClaim(claimId);
    return { error: receiptSaveErrorMessage(err) };
  }
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
    select: { id: true, filePath: true },
  });

  let saved;
  try {
    saved = await saveReceiptInputs(reimbursementId, inputs);
  } catch (err) {
    console.error("receipt save failed", { reimbursementId, err });
    return receiptSaveErrorMessage(err);
  }

  const newReceiptIds: string[] = [];
  try {
    for (const file of saved) {
      const row = await withDbRetry(() =>
        prisma.reimbursementReceipt.create({
          data: {
            reimbursementId,
            filePath: file.filePath,
            fileData: file.fileData ? new Uint8Array(file.fileData) : undefined,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
          },
        }),
      );
      newReceiptIds.push(row.id);
    }

    await withDbRetry(() =>
      prisma.reimbursementReceipt.deleteMany({
        where: {
          reimbursementId,
          id: { notIn: newReceiptIds },
        },
      }),
    );
  } catch (err) {
    console.error("receipt database write failed", { reimbursementId, err });
    if (newReceiptIds.length > 0) {
      await prisma.reimbursementReceipt
        .deleteMany({ where: { id: { in: newReceiptIds } } })
        .catch((deleteErr) => {
          console.error("could not roll back new receipt rows", {
            reimbursementId,
            deleteErr,
          });
        });
      await deleteStoredReceiptFiles(saved.map((file) => file.filePath));
    }
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
