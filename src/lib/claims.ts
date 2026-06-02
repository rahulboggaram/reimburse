import type { Prisma } from "@prisma/client";

export const claimInclude = {
  approver: { select: { id: true, name: true, phone: true } },
  branch: { select: { id: true, name: true, active: true } },
  receipts: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.ReimbursementInclude;

export type ClaimWithRelations = Prisma.ReimbursementGetPayload<{
  include: typeof claimInclude;
}>;

export function serializeClaim(claim: ClaimWithRelations) {
  return {
    id: claim.id,
    employeeId: claim.employeeId,
    employeeName: claim.employeeName,
    amount: Number(claim.amount),
    category: claim.category,
    description: claim.description,
    expenseDate: claim.expenseDate.toISOString(),
    branchId: claim.branchId,
    branch: claim.branch,
    status: claim.status,
    rejectionReason: claim.rejectionReason,
    decidedAt: claim.decidedAt?.toISOString() ?? null,
    razorpayPayoutId: claim.razorpayPayoutId,
    payoutStatus: claim.payoutStatus,
    payoutUtr: claim.payoutUtr,
    payoutError: claim.payoutError,
    payoutInitiatedAt: claim.payoutInitiatedAt?.toISOString() ?? null,
    paidAt: claim.paidAt?.toISOString() ?? null,
    approverId: claim.approverId,
    approver: claim.approver,
    refiledFromId: claim.refiledFromId,
    receipts: claim.receipts.map((receipt) => ({
      id: receipt.id,
      url: receipt.filePath,
      fileName: receipt.fileName,
      mimeType: receipt.mimeType,
    })),
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
  };
}
